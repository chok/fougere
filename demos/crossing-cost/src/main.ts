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
import { log } from '@fougere/log';
import { createApp, createLocalRunner, declaredTopologyOf, resolveEffectiveOperations, type Storage } from '@fougere/core';
import { loadConfig, remotesOf } from '@fougere/core/node';
import { createContainer } from '@fougere/container';
import { createHttpTransport, serve } from '@fougere/transport-http';
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

const remotes = remotesOf(config);

/** `ledger` is placed and served by nobody, on purpose — every other placed frond answers. */
const LEDGER = 'ledger';

const boot = (fronds: typeof scan, elsewhere: Record<string, string>) => createApp({
  scan: fronds,
  createContainer,
  storageFactory: shelf,
  remotes: elsewhere,
  remoteTransport: (url) => createHttpTransport(url),
  extensions: [log()],
});

/** Each frond `fronds:` places at an address answers there: an app of its own, behind real HTTP. */
const answering = await Promise.all(Object.entries(remotes)
  .filter(([frond]) => frond !== LEDGER)
  .map(async ([frond, url]) => {
    // Scanned alone, the way `fougere serve <frond>` carries one: two hosts holding `cart` both
    // would answer for it, and a caller could not choose.
    const host = await boot(
      await scanProject(root, [frond]),
      Object.fromEntries(Object.entries(remotes).filter(([other]) => other !== frond)),
    );
    const receiver = await serve(createLocalRunner(host), { port: Number(new URL(url).port) });

    return { host, receiver };
  }));

await using app = await boot(scan, remotes);

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
    `    ${op.operation.padEnd(24)} answers ${op.placement.padEnd(7)}`
    + ` reaches ${reached.padEnd(18)} ${op.reach.hops} hop(s)`,
  );
}

// The same call either way: function calls when everything is here, HTTP when a line is uncommented.
const out = await createLocalRunner(app)(
  { address: 'cart', op: 'checkout' },
  { params: {}, query: {}, input: undefined, state: {} },
);
console.log('\n  cart.checkout →', JSON.stringify(out));
console.log(answering.length === 0
  ? '\n  Now uncomment the two lines in fougere.config.ts and run it again.\n'
  : `\n  The same answer, with ${answering.length} frond(s) answering over HTTP. No handler changed.\n`);

for (const { host, receiver } of answering) {
  await receiver.close();
  await host.dispose();
}
