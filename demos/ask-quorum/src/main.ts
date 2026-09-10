/**
 * One question, three processes that answer, and an asker that names none of them.
 *
 *   BookingHandler ── Ask<CanBook> ──┬─▶ rooms    :4701
 *                                    ├─▶ billing  :4702
 *                                    └─▶ calendar :4703
 *
 * `Ask` is the dual of `Emit`: both name a SUBJECT rather than a recipient, and this one
 * waits. Waiting is possible because the responders are KNOWN — read from their signatures
 * at boot, wherever they run. A carrier (`onEmit`) would make them unknowable, and asking
 * such a subject is refused at boot rather than half-answered in silence.
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
import { asking } from './asking-storage.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { interopDefault: true, alias: await frondAliases(root) });
setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);

/** The whole topology statement. Without it, the same three fronds run here. */
const remotes = process.env.SPLIT
  ? { rooms: 'http://127.0.0.1:4701', billing: 'http://127.0.0.1:4702', calendar: 'http://127.0.0.1:4703' }
  : undefined;

/** The adapter, and the extension that hands it a door onto the app — see the file. */
const storage = asking();

const app = await createApp({
  scan: await scanProject(root),
  createContainer,
  storageFactory: storage.storageFactory,
  extensions: [storage.extension],
  ...(remotes ? { remotes, remoteTransport: (url: string) => createHttpTransport(url) } : {}),
});

console.log(`\n  the responders are ${remotes ? 'in THREE other processes' : 'here, in this process'}\n`);

const run = createLocalRunner(app);
for (const room of ['library', 'atrium']) {
  try {
    const asked = await run({ entity: 'booking', op: 'reserve' }, { ...Invocation.empty, params: { room } });
    const verdict = asked as { room: string; booked: boolean; said: string[] };

    console.log(`  ${room.padEnd(8)} → ${verdict.booked ? 'BOOKED' : 'refused'}`);
    for (const one of verdict.said) console.log(`      ${one}`);
  } catch (refused) {
    // Not a shrunken answer: a responder that did not answer refuses the question, or the
    // asker's own law would read silence as consent.
    console.log(`  ${room.padEnd(8)} → unanswered — ${(refused as Error).message.split('\n')[0]}`);
  }
}

console.log(`
  BookingHandler holds no list of responders and names none. Three answered, one refused,
  and the law — unanimity — is written in the asker, never in the framework.

  The STORAGE asked the same subject again, on its own account. It is not user code and has
  no app, so an extension handed it one — the only moment an adapter can be given a door.

  SPLIT=1 pnpm dev   with the three up   — the same answers, three wires later
  SPLIT=1 pnpm dev   with one down       — the question is unanswered, not answered by two
`);

await app.dispose();
