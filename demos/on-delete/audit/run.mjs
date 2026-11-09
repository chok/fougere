import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { appendFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import Sqlite from 'better-sqlite3';
import { RPC_ADDRESS } from '@fougere/core';
import { createHttpTransport } from '../../../packages/transport/http/dist/index.js';

const selected = process.argv[2] ?? 'all';
const filter = process.argv[3];
const root = mkdtempSync(join(tmpdir(), 'fougere-references-'));
console.log(JSON.stringify({ evidence: root, node: process.version }));
const results = [];
const portUrl = (port) => `http://127.0.0.1:${port}`;
const worker = new URL('./worker.mjs', import.meta.url);

async function within(promise, label, ms = 4000) {
  const timer = AbortSignal.timeout(ms);
  let expire;
  const timeout = new Promise((_, reject) => {
    expire = () => reject(new Error(`Harness timeout: ${label}`));
    timer.addEventListener('abort', expire);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    timer.removeEventListener('abort', expire);
  }
}

function launch(settings, log) {
  const child = fork(worker, [JSON.stringify(settings)], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  const out = (line) => log({ side: settings.side, pid: child.pid, ...line });
  const pending = new Map();
  const events = new Map();
  let next = 0;
  let port;
  let stopped = false;
  const event = (name) => {
    if (!events.has(name)) events.set(name, Promise.withResolvers());
    return events.get(name);
  };
  const exited = Promise.withResolvers();

  child.stdout.on('data', (data) => out({ stdout: data.toString() }));
  child.stderr.on('data', (data) => out({ stderr: data.toString() }));
  child.on('message', (message) => {
    if (message.event === 'log') out(message.record);
    else if (message.event === 'ready') {
      port = message.port;
      event('ready').resolve(port);
    } else if (message.event === 'gate') {
      out({ checkpoint: message.name });
      event(message.name).resolve();
    } else {
      pending.get(message.id)?.resolve(message);
      pending.delete(message.id);
    }
  });
  child.on('exit', (code, signal) => {
    stopped = true;
    out({ exit: { code, signal } });
    for (const call of pending.values()) call.resolve({ ok: false, error: { code: signal ?? code, message: 'worker exited' } });
    pending.clear();
    exited.resolve();
  });

  return {
    get port() { return port; },
    get stopped() { return stopped; },
    ready: () => within(event('ready').promise, `listen ${settings.side}`),
    reached: (name) => within(event(name).promise, name),
    async send(method, ...args) {
      if (stopped) throw new Error(`${settings.side} is down`);
      const id = ++next;
      const pendingCall = Promise.withResolvers();
      pending.set(id, pendingCall);
      child.send({ id, method, args });
      const result = await within(pendingCall.promise, `${settings.side}.${method}`);
      out({ method, args, result });
      return result;
    },
    async kill() {
      if (!stopped) child.kill('SIGKILL');
      await within(exited.promise, 'SIGKILL');
    },
    async close() {
      if (!stopped) child.kill('SIGTERM');
      await within(exited.promise, 'SIGTERM');
    },
  };
}

function snapshot(paths) {
  return Object.fromEntries(Object.entries(paths).map(([name, path]) => {
    const db = new Sqlite(path, { readonly: true, fileMustExist: true });
    try {
      const tables = db.prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name").all();
      return [name, Object.fromEntries(tables.map(({ name: table }) => {
        const quoted = `"${table.replaceAll('"', '""')}"`;
        return [table, {
          rows: db.prepare(`select * from ${quoted} order by id`).all(),
          fk: db.pragma(`foreign_key_list(${quoted})`).map(({ table, from, to, on_delete }) => ({ table, from, to, on_delete })),
        }];
      }))];
    } finally {
      db.close();
    }
  }));
}

const success = ({ ok, error, value }) => {
  assert.equal(ok, true, JSON.stringify(error));
  return value;
};
const refused = ({ ok, error }, pattern) => {
  assert.equal(ok, false, 'operation succeeded');
  if (pattern) assert.match(JSON.stringify(error), pattern);
  return error;
};
const capture = async (call) => {
  try {
    return { ok: true, value: await call() };
  } catch (error) {
    return { ok: false, error: { code: error.code, message: error.message } };
  }
};

async function run(config, name, test, options = {}) {
  const file = join(root, `${config}-${name}`);
  const paths = ['A', 'C'].includes(config)
    ? { shared: `${file}.db` }
    : { users: `${file}-users.db`, orders: `${file}-orders.db` };
  const log = (event) => appendFileSync(`${file}.jsonl`, JSON.stringify(event) + '\n');
  const live = [];
  const settings = { config, paths, journal: options.journal, model: options.model };
  const start = async (side, extra = {}) => {
    const child = launch({ ...settings, side, ...extra }, log);
    live.push(child);
    await child.ready();
    return child;
  };
  let users;
  let orders;
  let result;
  let booted = false;
  const splitProcess = ['C', 'D'].includes(config);
  const remotesFor = (side) => {
    if (!splitProcess || side === 'both') return {};
    if (options.oneWay === side) return {};
    return side === 'users' ? { orders: portUrl(orders.port) } : { users: portUrl(users.port) };
  };
  const boot = (child, side) => child.send('boot', remotesFor(side));
  const world = {
    config, paths, log,
    get users() { return users; },
    get orders() { return orders; },
    async restart(side, extra = {}) {
      if (!splitProcess) {
        users = orders = await start('both', extra);
        success(await boot(users, 'both'));
      } else {
        const port = world[side].port;
        const replacement = await start(side, { port, onlyOwn: options.onlyOwn, ...extra });
        if (side === 'users') users = replacement;
        else orders = replacement;
        success(await boot(replacement, side));
      }
    },
    async addUsers(...ids) {
      for (const id of ids) success(await world.row('user', 'create', { id }));
    },
    row(entity, op, ...args) {
      return (['user', 'cycleUser'].includes(entity) ? users : orders).send('rows', entity, op, ...args);
    },
    snap(label) {
      const state = snapshot(paths);
      log({ snapshot: label, state });
      return state;
    },
    rows(table) {
      return Object.values(snapshot(paths)).flatMap((database) => database[table]?.rows ?? []);
    },
    sql(side, statement) {
      const db = new Sqlite(paths[side] ?? paths.shared);
      try { db.exec(statement); } finally { db.close(); }
      log({ sql: statement, side });
    },
    async migrate(extra) {
      const coordinator = await start(extra.side ?? 'both', { migrate: true, ...extra });
      return coordinator.send('boot', {});
    },
  };

  try {
    const coordinator = await start('both', { migrate: true });
    success(await boot(coordinator, 'both'));
    await coordinator.close();
    if (splitProcess) {
      [users, orders] = await Promise.all([
        start('users', { onlyOwn: options.onlyOwn }),
        start('orders', { onlyOwn: options.onlyOwn, migrate: config === 'D' && options.journal }),
      ]);
      for (const outcome of await Promise.all([boot(users, 'users'), boot(orders, 'orders')])) success(outcome);
    } else {
      users = orders = await start('both');
      success(await boot(users, 'both'));
    }
    world.snap('schema');
    booted = true;
    await test(world);
    result = { status: 'PASS' };
  } catch (error) {
    result = { status: booted && error.code === 'ERR_ASSERTION' ? 'FAIL' : 'BLOCKED', message: error.message };
  } finally {
    await Promise.all(live.map((child) => child.close()));
    try {
      result.final = world.snap('final');
    } catch (error) {
      result.snapshotError = error.message;
    }
  }
  const record = { config, name, ...result };
  results.push(record);
  console.log(JSON.stringify({ config, name, status: result.status, message: result.message }));
}

const uid = (rows) => rows.map(({ id }) => id);
const createOrder = (world, fields = {}) => world.row('order', 'create', { id: 'o', ...fields });
const removal = (world, id = 'u') => world.row('user', 'delete', id);
const relationRpc = async (world, child, op, params) => {
  if (!child.port) return child.send('rpc', op, params);
  const transport = createHttpTransport(portUrl(child.port), { timeoutMs: 1200, retries: 0 });
  const result = await capture(() => transport({ address: RPC_ADDRESS, op }, { params, query: {}, state: {} }));
  world.log({ probe: op, port: child.port, params, result });
  return result;
};
const hold = (world, child, keys) => relationRpc(world, child, 'holds', { entity: 'user', keys });
const seedChain = async (world) => {
  await world.addUsers('u');
  success(await createOrder(world, { buyerId: 'u' }));
  success(await world.row('line', 'create', { id: 'l', orderId: 'o' }));
};

const cases = {
  async references(w) {
    await w.addUsers('u', 'v');
    success(await createOrder(w, { buyerId: 'u', sponsorId: 'v' }));
    refused(await w.row('order', 'create', { id: 'ghost', buyerId: 'absent' }), /exist|foreign key/i);
    refused(await w.row('order', 'update', 'o', { buyerId: 'absent' }), /exist|foreign key/i);
    success(await w.row('order', 'update', 'o', { buyerId: 'v' }));
    success(await removal(w));
    assert.deepEqual(uid(w.rows('users')), ['v']);
    assert.deepEqual(w.rows('orders').map((row) => [row.id, row.buyer_id]), [['o', 'v']]);
    const resolved = success(await w.orders.send('facade', 'user', 'findById', 'v'));
    assert.equal(resolved.id, 'v');
    await w.users.kill();
    await w.restart('users');
    assert.equal(success(await w.orders.send('facade', 'user', 'findById', 'v')).id, 'v');
    success(await w.row('order', 'create', { id: 'after', buyerId: 'v' }));
    assert.deepEqual(uid(w.rows('orders')), ['after', 'o']);
  },
  async holds(w) {
    await w.addUsers('u');
    const reads = await Promise.all([hold(w, w.users, ['u', 'missing']), hold(w, w.users, ['u'])]);
    assert.deepEqual(reads.map(success), [{ missing: ['missing'] }, { missing: [] }]);
    assert.equal(success(await removal(w)), true);
    assert.deepEqual(uid(w.rows('users')), []);
    assert.deepEqual(success(await hold(w, w.users, ['u'])), { missing: ['u'] });
  },
  async restrict(w) {
    await w.addUsers('u');
    success(await createOrder(w, { approverId: 'u' }));
    refused(await removal(w), /point|foreign key/i);
    assert.deepEqual(uid(w.rows('users')), ['u']);
    assert.deepEqual(uid(w.rows('orders')), ['o']);
    success(await w.row('order', 'delete', 'o'));
    assert.equal(success(await removal(w)), true);
    assert.deepEqual(uid(w.rows('users')), []);
  },
  async cascade(w) {
    await seedChain(w);
    assert.equal(success(await removal(w)), true);
    assert.deepEqual(['users', 'orders', 'lines'].map((table) => uid(w.rows(table))), [[], [], []]);
    assert.equal(success(await removal(w)), false);
  },
  async set_null(w) {
    await w.addUsers('u');
    success(await createOrder(w, { reviewerId: 'u' }));
    assert.equal(success(await removal(w)), true);
    assert.deepEqual(w.rows('orders').map((row) => [row.id, row.reviewer_id]), [['o', null]]);
    assert.deepEqual(uid(w.rows('users')), []);
  },
  async cycle(w) {
    success(await w.row('cycleUser', 'create', { id: 'cu' }));
    success(await w.row('cycleOrder', 'create', { id: 'co', peerId: 'cu' }));
    success(await w.row('cycleUser', 'update', 'cu', { peerId: 'co' }));
    const outcome = await Promise.race([
      w.row('cycleUser', 'delete', 'cu'),
      delay(1500, { ok: false, error: { code: 'AUDIT_DEADLINE', message: 'no delete response in 1500 ms' } }, { ref: false }),
    ]);
    assert.equal(success(outcome), true);
    assert.deepEqual(['cycle_users', 'cycle_orders'].map((table) => uid(w.rows(table))), [[], []]);
  },
  async race(w) {
    await w.addUsers('u');
    const keyed = w.config === 'A' || w.config === 'C';
    const gate = keyed ? 'before:create:order:o' : 'before:findByKeys:user';
    const held = keyed ? w.orders : w.users;
    success(await held.send('gate', gate));
    const creating = createOrder(w, { approverId: 'u' });
    await held.reached(gate);
    const removing = removal(w);
    await delay(150);
    success(await held.send('resume', gate));
    const [deleting, created] = await Promise.all([removing, creating]);
    w.snap('race-settled');
    assert.equal(deleting.ok && deleting.value === true && created.ok, false,
      'delete and create both succeeded across a RESTRICT relation');
    assert.ok(w.rows('orders').length === 0 || w.rows('users').length > 0, 'dangling reference');
  },
  async race_delete_first(w) {
    await w.addUsers('u');
    const gate = 'before:delete:user:u';
    success(await w.users.send('gate', gate));
    const removing = removal(w);
    await w.users.reached(gate);
    const created = await createOrder(w, { approverId: 'u' });
    w.snap('create-while-marked');
    refused(created, /being deleted/);
    success(await w.users.send('resume', gate));
    assert.equal(success(await removing), true);
    assert.deepEqual(['users', 'orders'].map((table) => uid(w.rows(table))), [[], []]);
    assert.deepEqual(w.rows('fougere_targets'), [], 'a mark outlived its release');
  },
  async database_lock(w) {
    await w.addUsers('u');
    const db = new Sqlite(w.paths.orders ?? w.paths.shared);
    try {
      db.exec('BEGIN IMMEDIATE');
      refused(await createOrder(w, { buyerId: 'u' }), /SQLITE_BUSY|locked/i);
      assert.deepEqual(uid(w.rows('orders')), []);
    } finally {
      db.close();
    }
    success(await createOrder(w, { buyerId: 'u' }));
    assert.deepEqual(uid(w.rows('orders')), ['o']);
  },
  async lost_ack(w) {
    await w.addUsers('u');
    const gate = 'after:create:order:o';
    success(await w.orders.send('gate', gate));
    const creating = createOrder(w, { buyerId: 'u' });
    await w.orders.reached(gate);
    w.snap('committed-before-ack');
    await w.orders.kill();
    refused(await creating, /SIGKILL/);
    await w.restart('orders');
    refused(await createOrder(w, { buyerId: 'u' }), /unique|conflict/i);
    assert.deepEqual(uid(w.rows('orders')), ['o']);
    assert.deepEqual(uid(w.rows('users')), ['u']);
  },
  async offline(w) {
    await seedChain(w);
    await w.orders.kill();
    refused(await removal(w), /SERVICE_UNAVAILABLE|unreachable/);
    assert.deepEqual(['users', 'orders', 'lines'].map((table) => uid(w.rows(table))), [['u'], ['o'], ['l']]);
    await w.restart('orders');
    assert.equal(success(await removal(w)), true);
    assert.deepEqual(['users', 'orders', 'lines'].map((table) => uid(w.rows(table))), [[], [], []]);
  },
  async release(w) {
    await seedChain(w);
    const release = (child) => relationRpc(w, child, 'release', { entity: 'user', key: 'u' });
    const target = w.config === 'A' ? w.users : w.orders;
    assert.deepEqual(success(await release(target)), { released: true });
    w.snap('first-release');
    assert.deepEqual(success(await release(target)), { released: true });
    assert.deepEqual(uid(w.rows('users')), ['u']);
    const keyed = w.config === 'A' || w.config === 'C';
    const expected = keyed ? [['o'], ['l']] : [[], []];
    assert.deepEqual(['orders', 'lines'].map((table) => uid(w.rows(table))), expected);
    assert.equal(success(await removal(w)), true);
    assert.deepEqual(['orders', 'lines'].map((table) => uid(w.rows(table))), [[], []]);
  },
  async cascade_kill(w) {
    await seedChain(w);
    const keyed = w.config === 'A' || w.config === 'C';
    const gate = keyed ? 'before:delete:user:u' : 'after:delete:order:o';
    const interrupted = keyed ? w.users : w.orders;
    success(await interrupted.send('gate', gate));
    const deleting = removal(w);
    await interrupted.reached(gate);
    w.snap('cascade-interrupted');
    await interrupted.kill();
    refused(await deleting);
    await w.restart(w.config === 'C' ? 'users' : 'orders');
    const beforeRetry = [uid(w.rows('users')), uid(w.rows('orders')), uid(w.rows('lines'))];
    assert.deepEqual(beforeRetry, keyed ? [['u'], ['o'], ['l']] : [['u'], [], []]);
    assert.equal(success(await removal(w)), true);
    assert.deepEqual(['users', 'orders', 'lines'].map((table) => uid(w.rows(table))), [[], [], []]);
  },
  async network_timeout(w) {
    await seedChain(w);
    const gate = 'respond:rpc.release';
    success(await w.orders.send('gate', gate));
    const deleting = removal(w);
    await w.orders.reached(gate);
    refused(await deleting, /GATEWAY_TIMEOUT|timed out/);
    w.snap('remote-committed-before-timeout');
    const keyed = w.config === 'C';
    assert.deepEqual(['users', 'orders', 'lines'].map((table) => uid(w.rows(table))), keyed ? [['u'], ['o'], ['l']] : [['u'], [], []]);
    success(await w.orders.send('resume', gate));
    assert.equal(success(await removal(w)), true);
    assert.deepEqual(['users', 'orders', 'lines'].map((table) => uid(w.rows(table))), [[], [], []]);
  },
  async network_retry_create(w) {
    await w.addUsers('u');
    const gate = 'respond:order.create';
    success(await w.orders.send('gate', gate));
    const send = createHttpTransport(portUrl(w.orders.port), { timeoutMs: 1200, retries: 1 });
    const create = () => capture(() => send({ address: 'order', op: 'create' }, {
      params: {}, query: {}, state: {}, input: { id: 'o', buyerId: 'u' },
    }));
    const creating = create();
    await w.orders.reached(gate);
    refused(await creating, /GATEWAY_TIMEOUT|timed out/);
    w.snap('create-committed-before-timeout');
    success(await w.orders.send('resume', gate));
    refused(await create(), /unique|conflict/i);
    assert.deepEqual(uid(w.rows('orders')), ['o']);
  },
  async missing_reverse_peer(w) {
    await w.addUsers('u');
    success(await createOrder(w, { approverId: 'u' }));
    const outcome = await removal(w);
    w.snap('one-way-after-delete');
    assert.equal(outcome.ok && outcome.value, false, 'users deleted a target still referenced by orders');
  },
  async missing_target_route(w) {
    const outcome = await createOrder(w, { approverId: 'absent' });
    assert.equal(outcome.ok, false, 'write without any route or target succeeded');
  },
  async wrong_owner_holds(w) {
    const outcome = await hold(w, w.orders, ['absent']);
    const missing = outcome.value?.missing ?? [];
    assert.ok(!outcome.ok || missing.includes('absent'), 'holds on an unhosted table reported no missing key');
  },
  async mixed_refusal(w) {
    await seedChain(w);
    success(await w.row('cycleUser', 'create', { id: 'unused' }));
    success(await w.row('order', 'create', { id: 'veto', approverId: 'u' }));
    refused(await removal(w), /point|foreign key/i);
    assert.deepEqual(['users', 'orders', 'lines'].map((table) => uid(w.rows(table))), [['u'], ['o', 'veto'], ['l']]);
  },
  async legacy(w) {
    const migration = await w.migrate({ model: 'current' });
    success(migration);
    await w.users.kill();
    await w.restart('users', { model: 'current' });
    await w.addUsers('u');
    const ghost = await createOrder(w, { buyerId: 'absent' });
    const newColumn = await w.row('order', 'create', { id: 'new', sponsorId: 'absent' });
    const valid = await w.row('order', 'create', { id: 'valid', buyerId: 'u' });
    success(valid);
    const deleted = await removal(w);
    success(deleted);
    refused(newColumn, /foreign key/i);
    assert.equal(ghost.ok, false, 'existing column gained no FK and admitted a dangling reference');
    assert.deepEqual(uid(w.rows('orders')), []);
  },
  async migration_only_own(w) {
    refused(await w.migrate({ side: 'orders', onlyOwn: true }), /no source holds User/);
  },
  async journal_recovery(w) {
    await seedChain(w);
    const gate = 'after:delete:order:o';
    success(await w.orders.send('gate', gate));
    const deleting = removal(w);
    await w.orders.reached(gate);
    await w.orders.kill();
    refused(await deleting);
    await w.restart('orders');
    w.snap('after-restart-before-lease-expiry');
    const runs = w.rows('runs').filter((row) => row.status === 'running');
    assert.ok(runs.length > 0, 'no running journal row left');
    const leaseUntil = Math.max(...runs.map((row) => row.lease_until));
    await delay(Math.max(0, leaseUntil - Date.now() + 75));
    success(await w.users.send('sweep'));
    assert.deepEqual(['users', 'orders', 'lines'].map((table) => uid(w.rows(table))), [[], [], []]);
  },
  async journal_row_failure(w) {
    await seedChain(w);
    w.sql('users', "create trigger abort_user before delete on users begin select raise(ABORT, 'audit root failure'); end");
    refused(await removal(w), /audit root failure/);
    w.snap('failed-root-statement');
    assert.deepEqual(['users', 'orders', 'lines'].map((table) => uid(w.rows(table))), [['u'], [], []]);
    w.sql('users', 'drop trigger abort_user');
    const swept = success(await w.users.send('sweep'));
    assert.deepEqual(uid(w.rows('users')), [], JSON.stringify(swept));
  },
  async journal_shared(w) {
    await seedChain(w);
    assert.equal(success(await removal(w)), true);
    assert.deepEqual(['users', 'orders', 'lines'].map((table) => uid(w.rows(table))), [[], [], []]);
    assert.deepEqual(w.rows('runs').filter((row) => row.status !== 'done').map((row) => row.id), [], 'a run was left open');
  },
  async read_timeout(w) {
    await w.addUsers('u');
    const gate = 'receive:rpc.holds';
    success(await w.users.send('gate', gate));
    const creating = createOrder(w, { buyerId: 'u' });
    await w.users.reached(gate);
    refused(await creating, /GATEWAY_TIMEOUT|timed out/);
    w.snap('after-read-timeout');
    assert.deepEqual(uid(w.rows('orders')), []);
    success(await w.users.send('resume', gate));
    success(await createOrder(w, { buyerId: 'u' }));
    assert.deepEqual(uid(w.rows('orders')), ['o']);
  },
  async generated_retry(w) {
    await w.addUsers('u');
    const gate = 'respond:order.create';
    success(await w.orders.send('gate', gate));
    const send = createHttpTransport(portUrl(w.orders.port), { timeoutMs: 1200, retries: 1 });
    const create = () => capture(() => send({ address: 'order', op: 'create' }, {
      params: {}, query: {}, state: {}, input: { buyerId: 'u' },
    }));
    const creating = create();
    await w.orders.reached(gate);
    refused(await creating, /GATEWAY_TIMEOUT|timed out/);
    w.snap('generated-commit-before-timeout');
    assert.equal(w.rows('orders').length, 1);
    success(await w.orders.send('resume', gate));
    success(await create());
    assert.equal(w.rows('orders').length, 1, 'the manual retry inserted a second order');
  },
  async journal_busy(w) {
    await seedChain(w);
    success(await w.row('order', 'create', { id: 'z', buyerId: 'u' }));
    const gate = 'before:delete:order:z';
    success(await w.orders.send('gate', gate));
    const deleting = removal(w);
    await w.orders.reached(gate);
    await w.orders.kill();
    refused(await deleting);
    w.snap('before-retry-with-active-lease');
    await w.restart('orders');
    const outcome = await removal(w);
    w.snap('after-retry-with-active-lease');
    assert.ok(!outcome.ok || !outcome.value || !w.rows('orders').length,
      'busy remote lease was acknowledged and parent deleted with a dependent left');
  },
  async raw_client(w) {
    await w.addUsers('u');
    success(await createOrder(w, { approverId: 'u' }));
    const outcome = await w.users.send('raw-delete', 'u');
    assert.ok(!outcome.ok || outcome.value === 0, 'raw client bypassed RESTRICT');
  },
  async local_veto(w) {
    await seedChain(w);
    success(await w.users.send('rows', 'userBadge', 'create', { id: 'b', userId: 'u' }));
    refused(await removal(w), /point|foreign key/i);
    assert.deepEqual(['users', 'user_badges', 'orders', 'lines'].map((table) => uid(w.rows(table))),
      [['u'], ['b'], ['o'], ['l']], 'delete was refused after removing dependents');
  },
};

const common = ['references', 'holds', 'restrict', 'cascade', 'set_null', 'cycle', 'race', 'database_lock', 'lost_ack', 'release', 'cascade_kill', 'mixed_refusal'];
const network = ['offline', 'network_timeout', 'network_retry_create', 'wrong_owner_holds', 'read_timeout'];
const plans = ['A', 'B', 'C', 'D'].flatMap((config) => [
  ...common.map((name) => ({ config, name })),
  { config, name: 'local_veto', options: { model: 'local-veto' } },
  ...(['B', 'D'].includes(config) ? [{ config, name: 'race_delete_first' }] : []),
  ...(['C', 'D'].includes(config)
    ? network.filter((name) => !(config === 'C' && name === 'read_timeout')).map((name) => ({ config, name }))
    : []),
  ...(config === 'A' ? [{ config, name: 'legacy', options: { model: 'legacy' } }] : []),
  ...(config === 'B' ? [{ config, name: 'journal_recovery', options: { journal: true } }] : []),
  ...(config === 'C' ? [
    { config, name: 'migration_only_own' },
    { config, name: 'journal_shared', options: { journal: true } },
  ] : []),
  ...(config === 'D' ? [
    { config, name: 'missing_reverse_peer', options: { onlyOwn: true, oneWay: 'users' } },
    { config, name: 'missing_target_route', options: { onlyOwn: true, oneWay: 'orders' } },
    { config, name: 'journal_recovery', options: { journal: true } },
    { config, name: 'journal_row_failure', options: { journal: true } },
    { config, name: 'journal_busy', options: { journal: true } },
    { config, name: 'generated_retry', options: { model: 'generated' } },
    { config, name: 'raw_client' },
    { config, name: 'cascade', options: { onlyOwn: true }, label: 'cascade_only_own' },
  ] : []),
]);

const chosen = plans.filter(({ config, name, label }) => (selected === 'all' || config === selected) && (!filter || (label ?? name) === filter));
assert.ok(chosen.length, 'usage: node demos/on-delete/audit/run.mjs [all|A|B|C|D] [case]');
const long = chosen.filter(({ name }) => name === 'journal_recovery')
  .map(({ config, name, options }) => run(config, name, cases[name], options));
for (const { config, name, options, label } of chosen.filter(({ name }) => name !== 'journal_recovery')) {
  await run(config, label ?? name, cases[name], options);
}
await Promise.all(long);
writeFileSync(join(root, 'results.json'), JSON.stringify(results, null, 2) + '\n');
if (results.some(({ status }) => status !== 'PASS')) process.exitCode = 1;
