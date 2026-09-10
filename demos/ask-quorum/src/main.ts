/**
 * One question, three processes that answer, and an announcer that names none of them.
 *
 *   BookingHandler ── Emit<CanBook, Verdict> ──┬─▶ rooms    :4701
 *                                              ├─▶ billing  :4702
 *                                              └─▶ calendar :4703
 *
 * The SECOND type is the whole declaration. `Emit<CanBook>` hands the question over and
 * returns nothing; `Emit<CanBook, Verdict>` waits for every subscriber and gives back what
 * they said. No option, no mode — which is why a boot can refuse the one case it cannot
 * honour: a carrier reaches whoever subscribed elsewhere and brings nothing back.
 *
 * A subscriber declares nothing either: `Fact<CanBook>` answering `Promise<Verdict>` has an
 * opinion, answering `Promise<void>` has none.
 *
 *   pnpm dev                                  # all four fronds here
 *   pnpm rooms & pnpm billing & pnpm calendar # then: SPLIT=1 pnpm dev
 */
import { createApp, createLocalRunner, Invocation } from '@fougere/core';
import { scanProject, frondAliases } from '@fougere/compiler';
import { setModuleLoader } from '@fougere/core/node';
import { createContainer } from '@fougere/container';
import { createHttpTransport } from '@fougere/transport-http';
import { createJiti } from 'jiti';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { interopDefault: true, alias: await frondAliases(root) });
setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);

/** The whole topology statement. Without it, the same three fronds run here. */
const remotes = process.env.SPLIT
  ? { rooms: 'http://127.0.0.1:4701', billing: 'http://127.0.0.1:4702', calendar: 'http://127.0.0.1:4703' }
  : undefined;

const app = await createApp({
  scan: await scanProject(root),
  createContainer,
  ...(remotes ? { remotes, remoteTransport: (url: string) => createHttpTransport(url) } : {}),
});

console.log(`\n  the subscribers are ${remotes ? 'in THREE other processes' : 'here, in this process'}\n`);

const run = createLocalRunner(app);
for (const room of ['library', 'atrium']) {
  try {
    const asked = await run({ entity: 'booking', op: 'reserve' }, { ...Invocation.empty, params: { room } });
    const verdict = asked as { booked: boolean; said: string[] };

    console.log(`  ${room.padEnd(8)} → ${verdict.booked ? 'BOOKED' : 'refused'}`);
    for (const one of verdict.said) console.log(`      ${one}`);
  } catch (refused) {
    // Not a shrunken answer: a subscriber that did not answer refuses the announcement, or
    // the announcer's own law would read silence as consent.
    console.log(`  ${room.padEnd(8)} → unanswered — ${(refused as Error).message.split('\n')[0]}`);
  }
}

console.log(`
  BookingHandler holds no list of subscribers and names none. Three answered, one refused,
  and the law — unanimity — is written in the announcer, never in the framework.

  SPLIT=1 pnpm dev   with the three up   — the same answers, three wires later
  SPLIT=1 pnpm dev   with one down       — the question is unanswered, not answered by two
`);

await app.dispose();
