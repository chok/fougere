import { createContainer } from '@fougere/container';
import { entity, optional, primary, ref, text } from '@fougere/schema';
import { createSqliteSource } from '@fougere/adapter-sql';
import { layerOf, storageFrom } from '@fougere/defaults';
import { createApp, createLocalRunner, frond, Invocation, migrating, Repository, RPC_ADDRESS } from '@fougere/core';
import { workflow } from '@fougere/workflow';
import { createHttpTransport, serve } from '../../../packages/transport/http/dist/index.js';
import { fileURLToPath } from 'node:url';

const settings = JSON.parse(process.argv[2]);
const { side, config, paths, journal, model } = settings;
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const log = (record) => process.send({ event: 'log', record });
const gates = new Map();

async function checkpoint(name) {
  const gate = gates.get(name);
  if (!gate) return;
  process.send({ event: 'gate', name });
  await gate.promise;
}

function descriptors() {
  class User extends entity({ id: primary(text()) }) {}
  const links = {
    buyerId: optional(ref(User, { onDelete: 'cascade' })),
    approverId: optional(ref(User)),
    reviewerId: optional(ref(User, { onDelete: 'set null' })),
  };
  class Order extends entity({
    id: model === 'generated' ? primary() : primary(text()),
    ...(model === 'legacy' ? { ...links, buyerId: optional(text()) } : links),
    ...(model === 'legacy' ? {} : { sponsorId: optional(ref(User)) }),
  }) {}
  class Line extends entity({
    id: primary(text()),
    orderId: ref(Order, { onDelete: 'cascade' }),
  }) {}
  class CycleUser extends entity({
    id: primary(text()),
    peerId: optional(ref(() => CycleOrder, { onDelete: 'cascade' })),
  }) {}
  class CycleOrder extends entity({
    id: primary(text()),
    peerId: optional(ref(CycleUser, { onDelete: 'cascade' })),
  }) {}
  class UserBadge extends entity({ id: primary(text()), userId: ref(User) }) {}
  class UserHandler extends Repository {}
  class OrderHandler extends Repository {}
  class LineHandler extends Repository {}
  class CycleUserHandler extends Repository {}
  class CycleOrderHandler extends Repository {}

  return [
    frond('users', {
      entities: [User, CycleUser, ...(model === 'local-veto' ? [UserBadge] : [])],
      handlers: [{ ctor: UserHandler, repository: User }, { ctor: CycleUserHandler, repository: CycleUser }],
    }),
    frond('orders', {
      entities: [Order, Line, CycleOrder],
      handlers: [
        { ctor: OrderHandler, repository: Order },
        { ctor: LineHandler, repository: Line },
        { ctor: CycleOrderHandler, repository: CycleOrder },
      ],
    }),
  ];
}

function observing(factory, after) {
  const reached = async (name) => { if (after) after.push(name); else await checkpoint(name); };

  return (schema, name) => {
    const base = factory(schema, name);

    return Object.assign(Object.create(base), {
      async create(...args) {
        await checkpoint(`before:create:${name}:${args[0].id}`);
        const result = await base.create(...args);
        await reached(`after:create:${name}:${args[0].id}`);

        return result;
      },
      async findByKeys(...args) {
        await checkpoint(`before:findByKeys:${name}`);

        return base.findByKeys(...args);
      },
      async delete(id) {
        await checkpoint(`before:delete:${name}:${id}`);
        const result = await base.delete(id);
        await reached(`after:delete:${name}:${id}`);

        return result;
      },
    });
  };
}

async function committed(after) {
  for (const name of after.splice(0)) await checkpoint(name);
}

function database(path) {
  const source = createSqliteSource({ path });
  source.sqlite.pragma('busy_timeout = 80');
  const { transacted } = source;
  source.transacted = async (fn) => {
    const after = [];
    const result = await transacted((factory) => fn(observing(factory, after)));
    await committed(after);

    return result;
  };

  return source;
}

function placed() {
  if (paths.shared) return { shared: { source: database(paths.shared) } };

  const sources = {};
  const runRows = journal ? ['Run', 'Later'] : [];
  if (side !== 'orders') {
    const badges = model === 'local-veto' ? ['UserBadge'] : [];
    sources.users = { source: database(paths.users), rows: ['User', 'CycleUser', ...badges, ...runRows] };
  }
  if (side !== 'users') {
    sources.orders = {
      source: database(paths.orders),
      rows: ['Order', 'Line', 'CycleOrder', ...(side === 'orders' ? runRows : [])],
    };
  }

  return sources;
}

let app;
let storage;
let runner;
const transport = (url) => {
  const send = createHttpTransport(url, { timeoutMs: 800, retries: 0 });

  return async (call, invocation) => {
    log({ sent: call, params: invocation.params });

    return send(call, invocation);
  };
};

const receiver = ['C', 'D'].includes(config) && side !== 'both'
  ? await serve(async (call, invocation) => {
    log({ received: call, params: invocation.params });
    await checkpoint(`receive:${call.address}.${call.op}`);
    const result = await runner(call, invocation);
    await checkpoint(`respond:${call.address}.${call.op}`);

    return result;
  }, { port: settings.port ?? 0 })
  : undefined;
process.send({ event: 'ready', port: receiver?.port });

async function boot(remotes) {
  storage = storageFrom(placed());
  const layer = layerOf(storage);
  const fronds = descriptors().filter((frond) => !settings.onlyOwn || frond.name === side);
  app = await createApp({
    ...layer,
    createContainer,
    fronds,
    remotes,
    remoteTransport: transport,
    storageFactory: observing(layer.storageFactory),
    extensions: [
      ...(journal ? [workflow({ sweepMs: 0 })] : []),
      ...(settings.migrate ? [migrating(storage.migrate)] : []),
    ],
  });
  runner = createLocalRunner(app);

  return Object.fromEntries(['user', 'order', 'line', 'cycleUser', 'cycleOrder', 'run']
    .map((entity) => [entity, Boolean(app.storageFor(entity))]));
}

async function dispatch(method, args) {
  switch (method) {
    case 'boot': return boot(...args);
    case 'gate': {
      const { promise, resolve } = Promise.withResolvers();
      gates.set(args[0], { promise, resolve });

      return true;
    }
    case 'resume': {
      const gate = gates.get(args[0]);
      gates.delete(args[0]);
      gate.resolve();

      return true;
    }
    case 'rpc': return runner({ address: RPC_ADDRESS, op: args[0] }, Invocation.from({ params: args[1] }));
    case 'facade': return app.facadeFor(args[0])[args[1]](Invocation.from({ params: { id: args[2] } }));
    case 'rows': return app.storageFor(args[0])[args[1]](...args.slice(2));
    case 'raw-delete': {
      const result = await app.storageFor('user').client.deleteFrom('users').where('id', '=', args[0]).executeTakeFirst();

      return Number(result.numDeletedRows);
    }
    case 'sweep': return runner({ address: 'run', op: 'sweep' }, Invocation.empty);
    case 'close':
      await receiver?.close();
      await app?.dispose();
      await storage?.close?.();

      return true;
    default: throw new Error(`Unknown worker command ${method}`);
  }
}

process.on('message', async ({ id, method, args }) => {
  try {
    const value = await dispatch(method, args);
    process.send({ id, ok: true, value }, () => { if (method === 'close') process.disconnect(); });
  } catch (error) {
    process.send({ id, ok: false, error: { code: error.code, message: error.message, cause: error.cause?.message } });
  }
});
