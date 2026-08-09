/**
 * Repository A. It publishes posts. It has never heard of a search engine.
 *
 * Twice: once with nothing carrying the fact out, once with a carrier. `PostHandler` is
 * the same file in both, and this repository holds no copy of anyone else's code.
 */
import { createApp, createLocalRunner, setModuleLoader, frondAliases } from '@fougere/core';
import type { App, InvocationContext } from '@fougere/core';
import { createContainer } from '@fougere/container-fougere';

const BROKER = `http://127.0.0.1:${process.env.BROKER_PORT ?? 4300}`;

const inv = (params: Record<string, string>): InvocationContext =>
  ({ params, query: {}, body: undefined, state: {} });

const settle = () => new Promise((r) => setTimeout(r, 400));

const publish = (app: App, id: string, title: string) =>
  createLocalRunner(app)({ entity: 'post', op: 'publish' }, inv({ id, title }));

async function main() {
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    // `@frond/<name>` is how a frond names its neighbour; the loader has to know it.
    alias: await frondAliases(import.meta.dirname),
  });
  setModuleLoader((path) => jiti.import(path) as Promise<Record<string, unknown>>);

  console.log(`\x1b[33m[blog · pid ${process.pid}]\x1b[0m repository A — knows only itself\n`);

  console.log('\x1b[1m1.\x1b[0m No carrier. The listener lives in another repository.');
  const alone = await createApp({ root: import.meta.dirname, createContainer });
  console.log('  ', await publish(alone, 'p1', 'Ferns are not plants that give up'));
  await settle();
  console.log('   \x1b[2m…and that is all. Nothing failed, nobody heard.\x1b[0m\n');

  console.log('\x1b[1m2.\x1b[0m With a carrier — the fact goes out under its own name.');
  const carried = await createApp({
    root: import.meta.dirname,
    createContainer,
    // The whole change. The name comes from the fact, never written by hand.
    onEmit: async (fact, payload) => {
      await fetch(`${BROKER}/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: fact, payload }),
      });
    },
  });
  console.log('  ', await publish(carried, 'p2', 'A frond is a leaf that repeats itself'));
  await settle();
  console.log('\n\x1b[2m   Watch the search terminal. This process still knows nothing about it.\x1b[0m\n');

  await alone[Symbol.asyncDispose]?.();
  await carried[Symbol.asyncDispose]?.();
}

main().catch((err) => { console.error(err); process.exit(1); });
