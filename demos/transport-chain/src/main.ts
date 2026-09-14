/**
 * One handler, four runs, and a list that decides what carries its calls.
 *
 *   cart ──▶ catalog          two crossings: list, then charge
 *
 *   pnpm dev
 *
 * `CartHandler` is never touched. What changes is the chain built below — the same shape
 * `ports: { Payment: ['Retrying', 'Stripe'] }` already has, read from the outside in.
 */
import { scanProject } from '@fougere/compiler';
import { createApp, createLocalRunner, type Storage, type Transport } from '@fougere/core';
import { loadConfig } from '@fougere/core/node';
import { createContainer } from '@fougere/container';
import { join } from 'node:path';
import { memory } from './transport/memory.js';
import { journal, type Kept } from './transport/journal.js';
import { retrying } from './transport/retrying.js';
import { cutting } from './transport/cutting.js';

const root = join(import.meta.dirname, '..');
const config = await loadConfig(root);
const scan = await scanProject(root);

const SHELF = [
  { id: 'p1', title: 'Fern', cents: 1200 },
  { id: 'p2', title: 'Moss', cents: 450 },
];

const shelf = () => ({
  async list() { return SHELF.map((product) => ({ ...product })); },
  output() { return this; },
}) as unknown as Storage;

const far = await createApp({ scan, createContainer, storageFactory: shelf });
const link = memory(far);

/** Boot the near side with one chain, ask it for a checkout, and say what crossed. */
async function run(name: string, chain: Transport) {
  link.reached.length = 0;
  await using near = await createApp({
    scan,
    createContainer,
    storageFactory: shelf,
    remotes: config.remotes ?? {},
    remoteTransport: () => chain,
  });

  const answer = await createLocalRunner(near)(
    { entity: 'cart', op: 'checkout' },
    { params: {}, query: {}, input: undefined, state: {} },
  ).catch((refused: Error) => `refused — ${refused.message}`);

  const crossed = link.reached.length === 0 ? '—' : link.reached.join(', ');
  console.log(`    ${name.padEnd(34)} ${String(JSON.stringify(answer)).padEnd(34)} crossed: ${crossed}`);
}

console.log('\n  One handler. The first column is the chain, the last is what left this process.\n');

await run('[link]', link.transport);

const kept: Kept[] = [];
await run('[journal, link]', journal(kept, link.transport));
await run('[journal, link] — again', journal(kept, link.transport));

// One cut, shared by the two runs below: the line drops once, and the replay is a second run
// over the journal the first one left behind.
const halfway: Kept[] = [];
const dropped = journal(halfway, cutting('charge', link.transport));
await run('[journal, cut, link]', dropped);
await run('[journal, cut, link] — replayed', dropped);

await run('[retrying, journal, cut, link]',
  retrying(1, journal([], cutting('charge', link.transport))));

console.log(`
  Line 2 crosses twice and keeps both answers. Line 3 crosses NOTHING and answers the same.

  Line 4 is the interesting one: the line drops on \`charge\`, the checkout refuses — but
  \`list\` already answered and is kept. Line 5 replays it: \`list\` never crosses again, only
  \`charge\` does. That is what a replay engine does, and no handler was told about it.

  Line 6 puts a retry in FRONT of the journal, so the same run absorbs the cut on its own.
  Change the order in that list and the behaviour changes; change no domain file at all.
`);
