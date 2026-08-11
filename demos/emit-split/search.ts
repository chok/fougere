/**
 * The search frond, alone in its own process.
 *
 * It serves `IndexHandler` over JSON-RPC and knows nothing about who might announce a
 * `PostPublished`. `remotes` is not declared here: an emitter reaches ITS listeners, and
 * a listener never reaches back.
 */
import { createApp, createAppRunner, setModuleLoader, frondAliases } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { serve } from '@fougere/transport-http';

const PORT = Number(process.env.PORT ?? 4210);

async function main() {
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    // `@frond/<name>` is how a frond names its neighbour; the loader has to know it.
    alias: await frondAliases(import.meta.dirname),
  });
  setModuleLoader((path) => jiti.import(path) as Promise<Record<string, unknown>>);

  const app = await createApp({
    root: import.meta.dirname,
    createContainer,
    // Only this frond runs here. `blog` stays on disk and is simply not loaded.
    fronds: ['search'],
  });

  await serve(createAppRunner(app), { port: PORT });
  console.log(`\x1b[36m[search · pid ${process.pid}]\x1b[0m listening on http://127.0.0.1:${PORT}`);
  console.log('  waiting for a fact…\n');
}

main().catch((err) => { console.error(err); process.exit(1); });
