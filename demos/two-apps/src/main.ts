/**
 * Two apps over the same fronds, one process, and what each one carries.
 *
 *   apps/api/    an HTTP app — carries `observed`: the call lines, and a ring of every call
 *   apps/ops/    a terminal  — states nothing, so it carries `platform:`: the call lines alone
 *   clock        a process at its url — carries `observed` too, the same variable
 *
 * Each app reads its name off its directory. Nothing under fronds/ says any of it.
 *
 *   pnpm dev                        this walk-through
 *   pnpm clock, pnpm api, pnpm ops  each one for real
 */
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { bootApp } from '@fougere/defaults';
import { createAppRunner, createLocalRunner, Invocation, RPC_ADDRESS, type App } from '@fougere/core';
import { serve } from '@fougere/transport-http';
import { bootApi } from '../apps/api/boot.js';
import { bootOps } from '../apps/ops/boot.js';

const root = join(import.meta.dirname, '..');
rmSync(join(root, '.data'), { recursive: true, force: true });

const ASCENT = new Set(['schema', 'values', 'seeds']);

const clock = await bootApp(root, { process: 'clock' });
const receiver = await serve(createLocalRunner(clock), { port: 4710 });
const api = await bootApi();
const ops = await bootOps();

const describe = (name: string, app: App) => {
  const carried = app.extensions().filter((member) => !ASCENT.has(member)).join(', ');
  const runs = app.fronds.filter((frond) => !frond.fromExtension && !(frond.name in app.remotes)).map((frond) => frond.name).join(', ');

  console.log(`  ${name.padEnd(6)} carries ${carried.padEnd(12)} runs ${runs}`);
};

console.log('\n  What each one carries — read off fougere.config.ts\n');
describe('api', api);
describe('ops', ops);
describe('clock', clock);

console.log('\n  api writes a note and asks clock the time\n');
await createAppRunner(api)({ address: 'note', op: 'create' }, { ...Invocation.empty, input: { title: 'Two apps, one table' } });
const now = await createAppRunner(api)({ address: 'clock', op: 'now' }, Invocation.empty);

console.log('\n  ops lists the notes\n');
const listed = await createAppRunner(ops)({ address: 'note', op: 'list' }, Invocation.empty) as { items: { title: string }[] };

const kept = await createLocalRunner(api)({ address: RPC_ADDRESS, op: 'calls' }, Invocation.empty) as { calls: unknown[] };

console.log(`
  clock.now, from api   → ${String(now)}   (crossed to :4710)
  note.list, from ops   → ${listed.items.map((note) => `"${note.title}"`).join(', ')}   (one SQLite file, two apps)
  api's ring kept ${kept.calls.length} call(s); ops carries no ring, since nothing in its platform keeps one
`);

await ops.dispose();
await api.dispose();
await clock.dispose();
await receiver.close();
