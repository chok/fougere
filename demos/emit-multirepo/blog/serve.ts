/**
 * Repository A, standing still so its card can be read.
 *
 * `main.ts` publishes twice and exits, which is enough to show a fact crossing — but not
 * enough for the OTHER half of the boundary. A subscriber in another repository needs the
 * fact's SHAPE, and the shape travels on `rpc.discover` like everything else.
 *
 * Nothing here is about emission. It is the same app, reachable.
 */
import { createApp, createAppRunner } from '@fougere/core';
import { scanProject, setModuleLoader, frondAliases } from '@fougere/core/node';
import { createContainer } from '@fougere/container';
import { serve } from '@fougere/transport-http';

const PORT = Number(process.env.CARD_PORT ?? 4301);

async function main() {
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    // `@fronds/<name>` is how a frond names its neighbour; the loader has to know it.
    alias: await frondAliases(import.meta.dirname),
  });
  setModuleLoader((path) => jiti.import(path) as Promise<Record<string, unknown>>);

  const app = await createApp({ scan: await scanProject(import.meta.dirname), createContainer });

  await serve(createAppRunner(app), { port: PORT });
  console.log(`\x1b[33m[blog · pid ${process.pid}]\x1b[0m card on http://127.0.0.1:${PORT}/_fougere/call`);
  console.log('   run `pnpm sync` in ../search — it announces postPublished\n');
}

main().catch((err) => { console.error(err); process.exit(1); });
