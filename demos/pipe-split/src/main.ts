/**
 * One fact, and the op that finishes it — here, or in another process.
 *
 *   PostHandler ── Emit<…> ──▶ [ RedactHandler ] ──▶ [ StampHandler ] ──▶ IndexHandler: Fact<…>
 *
 * TWO links, in the order `fronds/blog/frond.config.ts` states — and the second reads what
 * the first answered. Behind `remotes:` they run in three processes and nothing changes.
 *
 * `Pipe<T>` is the third word of the family: `Emit` announces, `Fact` receives, `Pipe`
 * ANSWERS the fact every subscriber then reads. A subscriber's answer is discarded — that
 * is what keeps a fact the same for everyone — so amending happens once, before anyone.
 *
 *   pnpm dev                                # every frond here
 *   pnpm dev:redact & pnpm dev:stamp        # each link in its own process
 *   REDACT_ELSEWHERE=1 pnpm dev             # then ask for them by address
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

/** The whole topology statement. Comment it out and the link runs in this process. */
const remotes = process.env.REDACT_ELSEWHERE
  ? { redact: 'http://127.0.0.1:4600', stamp: 'http://127.0.0.1:4601' }
  : undefined;

const app = await createApp({
  scan: await scanProject(root),
  createContainer,
  ...(remotes ? { remotes, remoteTransport: (url: string) => createHttpTransport(url) } : {}),
});

console.log(`\n  the link is ${remotes ? 'BEHIND remotes: — another process' : 'here, in this process'}\n`);

const run = createLocalRunner(app);
try {
  await run({ entity: 'post', op: 'publish' }, { ...Invocation.empty, params: { id: '42' } });
} catch (refused) {
  // Announcing is DISPATCH, and finishing a fact is not: the link answers the fact, so an
  // announcement waits for it. Behind `remotes:` that makes publishing depend on another
  // process — which is the price this demo exists to show.
  console.log(`    refused → ${(refused as Error).message.split('\n')[0]}`);
}

// Dispatch is not delivery: the emitter returned before the subscriber finished.
await new Promise((resolve) => setTimeout(resolve, 60));

console.log(`
  Two links ran, in the order fronds/blog/frond.config.ts states. The second read what the
  first answered — redacted=true is StampHandler seeing RedactHandler's work — and the
  subscriber read only the end of the chain.

  REDACT_ELSEWHERE=1 pnpm dev   with :4600 up   — the same, one wire crossing later
  REDACT_ELSEWHERE=1 pnpm dev   with :4600 down — publishing itself fails
`);

await app.dispose();
