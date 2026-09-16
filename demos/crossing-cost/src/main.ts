/**
 * What a crossing costs, and the one line that decides it.
 *
 *   cart ──▶ pricing ──▶ catalog          a chain of three, which is why it exists
 *   cart ──▶ catalog                      and a shortcut past the middle
 *   cart ──▶ ledger                       declared, answered by nobody
 *
 *   pnpm dev            read the two halves and what each op reaches
 *
 * Then uncomment a line in `fougere.config.ts` and run it again. No handler changes.
 */
import { scanProject } from '@fougere/compiler';
import { createApp, createLocalRunner, declaredTopologyOf, resolveEffectiveOperations, type Storage } from '@fougere/core';
import { loadConfig, remotesOf } from '@fougere/core/node';
import { createContainer } from '@fougere/container';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const config = await loadConfig(root);
const scan = await scanProject(root);

const SHELF = [
  { id: 'p1', title: 'Fern', cents: 1200 },
  { id: 'p2', title: 'Moss', cents: 450 },
];

/** Held in memory: this demo is about what a call CROSSES, not about where rows live. */
const shelf = () => ({
  async list() { return SHELF.map((product) => ({ ...product })); },
  output() { return this; },
}) as unknown as Storage;

await using app = await createApp({
  scan,
  createContainer,
  storageFactory: shelf,
  remotes: remotesOf(config),
  // Nothing answers at those addresses. A call would refuse; reading the shape does not.
  remoteTransport: () => (async () => { throw new Error('nobody is listening there'); }),
});

const declared = declaredTopologyOf(app);
const { operations } = resolveEffectiveOperations(app.fronds, { remotes: remotesOf(config) });

console.log('\n  Declared — what the config says\n');
for (const frond of declared.fronds) {
  console.log(`    ${frond.frond.padEnd(9)} ${frond.placement === 'local' ? 'here' : `elsewhere  ${frond.at}`}`);
}

console.log('\n  Declared — which frond reaches which\n');
for (const edge of declared.edges) console.log(`    ${edge.from} → ${edge.to}`);
console.log('\n    ledger is declared and reached by nobody — a config line with no code behind it.');

console.log('\n  Reach — where each op ANSWERS, and where its work GOES\n');
for (const op of operations) {
  const reached = op.reach.fronds.map((one) => one.frond).join(', ') || '—';
  console.log(
    `    ${op.operation.padEnd(24)} answers ${op.placement.runtime.padEnd(7)}`
    + ` reaches ${reached.padEnd(18)} ${op.reach.hops} hop(s)`,
  );
}

// Everything is local right now, so this costs function calls and nothing else.
const out = await createLocalRunner(app)(
  { entity: 'cart', op: 'checkout' },
  { params: {}, query: {}, input: undefined, state: {} },
);
console.log('\n  cart.checkout →', JSON.stringify(out));
console.log('\n  Now uncomment a line in fougere.config.ts and run it again.\n');
