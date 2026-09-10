/**
 * One fact, and the op that finishes it — here, or in another process.
 *
 *   PostHandler ── Emit<…> ──▶ [ TenantHandler ] ──▶ [ HashHandler ] ──▶ IndexHandler: Fact<…>
 *
 * What a link is NOT for: dropping a field. `PostPublished` is `Post.pick(…)`, so the
 * author's address is absent because it was never declared — omission is the schema's work.
 *
 * What a link IS for: what remains and must be TRANSFORMED. The account has to be looked
 * up, which needs a dependency the blog should not hold; the author has to reach a reader
 * as a hash, which `pick` cannot produce. And the order is forced, not chosen: the lookup
 * reads the id the hash replaces.
 *
 * `Pipe<T>` is the third word of the family: `Emit` announces, `Fact` receives, `Pipe`
 * ANSWERS the fact every subscriber then reads. A subscriber's answer is discarded — that
 * is what keeps a fact the same for everyone — so amending happens once, before anyone.
 *
 *   pnpm dev                              # every frond here
 *   pnpm link:tenant & pnpm link:privacy  # each link in its own process
 *   SPLIT=1 pnpm dev                      # then reach them by address
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
const remotes = process.env.SPLIT
  ? { tenant: 'http://127.0.0.1:4600', privacy: 'http://127.0.0.1:4601' }
  : undefined;

const app = await createApp({
  scan: await scanProject(root),
  createContainer,
  ...(remotes ? { remotes, remoteTransport: (url: string) => createHttpTransport(url) } : {}),
});

console.log(`\n  the two links are ${remotes ? 'in TWO other processes' : 'here, in this process'}\n`);

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
  The account was resolved from the author, and the author is now a hash — in that order,
  because the second link would otherwise be handed what the first had already replaced.
  The subscriber reads the end of the chain and cannot tell there was one.

  SPLIT=1 pnpm dev   with :4600 and :4601 up   — the same, two wires later
  SPLIT=1 pnpm dev   with one down             — publishing itself fails: a link is called
`);

await app.dispose();
