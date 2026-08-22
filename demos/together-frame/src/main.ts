/**
 * One handler, two guarantees, and the config line that decides which.
 *
 * Run it as it stands: `sources:` is commented out, everything shares one engine, and the
 * frames are transactions. Uncomment the block in fougere.config.ts and run again — the
 * same handlers, the same results, and one line of boot output that is not the same.
 */
import { scanProject } from '@fougere/core/node';
import { createApp, createLocalRunner, migrating, EMPTY_INVOCATION, type App, type EntityOrm } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { storageFrom } from '@fougere/defaults';
import { setupSqlite } from '@fougere/adapter-sql';
import { observeWith } from '../fronds/banking/observe.js';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const data = join(root, '.data');
rmSync(data, { recursive: true, force: true });

/** Read the demo's own config the way the boot does, so the comment block is the switch. */
const { default: config } = await import(join(root, 'fougere.config.ts')) as {
  default: { sources?: Record<string, { path: string; entities: string[] }> };
};
const split = config.sources !== undefined;

const storage = storageFrom({
  db: setupSqlite({ path: join(data, 'app.db') }),
  sources: Object.fromEntries(Object.entries(config.sources ?? {}).map(([name, source]) => [
    name,
    { setup: setupSqlite({ path: join(root, source.path) }), entities: source.entities },
  ])),
});

console.log(`\n${'─'.repeat(72)}`);
console.log(split
  ? 'sources: DECLARED — Ledger lives in its own database'
  : 'sources: commented out — everything shares one connection');
console.log('─'.repeat(72));

const app: App = await createApp({
  scan: await scanProject(root),
  createContainer,
  ormFactory: storage.ormFactory,
  sourceOf: storage.sourceOf,
  transacted: storage.transacted as never,
  // The storage's ascent, declared rather than called by hand after the boot.
  extensions: [migrating(storage.migrate)],
});

/**
 * A reader on its OWN connection — what a second process, or another request, would see.
 *
 * The app's ORM cannot answer this: under a transaction it IS the writing connection, and a
 * connection always sees its own uncommitted writes.
 */
const outside = setupSqlite({ path: join(data, 'app.db') });
observeWith(async () => {
  const ada = outside.sqlite.prepare('select balance from accounts where id = ?').get('ada') as { balance: number };
  return `ada ${ada.balance}`;
});

const orm = (entity: string) => app.ormFor(entity) as EntityOrm;
const call = createLocalRunner(app);
const run = (entity: string, op: string, params: Record<string, unknown> = {}) =>
  call({ entity, op }, { ...EMPTY_INVOCATION, params: params as never });

await orm('account').create({ id: 'ada', owner: 'Ada', balance: 1000 });
await orm('account').create({ id: 'bob', owner: 'Bob', balance: 0 });
await orm('rateCard').create({ code: 'EUR', rate: 0.5 });

/** What the two tables hold, in one line. */
const state = async () => {
  const [ada, bob] = await Promise.all([orm('account').findById('ada'), orm('account').findById('bob')]);
  const lines = await orm('ledger').list();
  const rates = await orm('rateCard').list();
  return `ada ${ada.balance} · bob ${bob.balance} · ledger ${lines.length} · rates ${rates
    .map((r: any) => `${r.code}=${r.rate}`).sort().join(' ')}`;
};

const attempt = async (title: string, what: () => Promise<unknown>) => {
  console.log(`\n${title}`);
  console.log(`   before  ${await state()}`);
  try {
    await what();
    console.log('   →       committed');
  } catch (failure) {
    console.log(`   →       ${(failure as Error).message}`);
  }
  console.log(`   after   ${await state()}`);
};

await attempt('1. a transfer that works', () => run('transfer', 'move', { from: 'ada', to: 'bob', amount: 100 }));

await attempt('2. the same three writes, and a failure after the last one',
  () => run('transfer', 'moveAndFail', { from: 'ada', to: 'bob', amount: 100 }));

await attempt('3. the ENTITY refusing the last write — balance may not go below zero',
  () => run('transfer', 'overdraw', { from: 'ada', to: 'bob' }));

await attempt('4. a mirror inside the frame — its pages come back too, and EUR is RESTORED to 0.5',
  () => run('refresh', 'syncAndFail'));

console.log(`\n${'─'.repeat(72)}`);
console.log(split
  ? 'No transaction ran. Every write above was taken back by replaying its inverse —\n'
    + 'one extra read per write, and no isolation: between two writes, a reader sees the half.'
  : 'One engine, so the transactions were real: nothing above cost an extra read, and\n'
    + 'no reader could ever have seen a half-done transfer.');
console.log(`Uncomment \`sources:\` in fougere.config.ts and run again. The handlers do not change.`);
console.log(`${'─'.repeat(72)}\n`);

await outside.db.destroy();
await app.dispose();
await storage.close!();
