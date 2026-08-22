/**
 * The same emission, twice: in this process, then across a wire.
 *
 * `PostHandler` is not read twice and not compiled twice. `remotes:` is the whole
 * difference between the two runs below — one line of deployment, zero lines of domain.
 *
 *   terminal 1   pnpm dev:search
 *   terminal 2   pnpm dev
 */
import { createApp, createLocalRunner } from '@fougere/core';
import { scanProject, setModuleLoader, frondAliases } from '@fougere/core/node';
import type { App, InvocationContext } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { createHttpTransport } from '@fougere/transport-http';

const SEARCH = `http://127.0.0.1:${process.env.PORT ?? 4210}`;

const inv = (params: Record<string, string>): InvocationContext =>
  ({ params, query: {}, body: undefined, state: {} });

/** Dispatch is not delivery — the emitter returns before its listeners are done. */
const settle = () => new Promise((r) => setTimeout(r, 300));

async function publish(app: App, id: string, title: string) {
  return createLocalRunner(app)({ entity: 'post', op: 'publish' }, inv({ id, title }));
}

function title(n: string, text: string) {
  console.log(`\n\x1b[1m${n}\x1b[0m ${text}`);
}

async function main() {
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    // `@frond/<name>` is how a frond names its neighbour; the loader has to know it.
    alias: await frondAliases(import.meta.dirname),
  });
  setModuleLoader((path) => jiti.import(path) as Promise<Record<string, unknown>>);

  title('1.', 'Both fronds in THIS process — nothing is declared, nothing is registered');

  const together = await createApp({ scan: await scanProject(import.meta.dirname), createContainer });
  console.log(await publish(together, 'p1', 'Ferns are not plants that give up'));
  await settle();

  title('2.', `search declared remote — remotes: { search: '${SEARCH}' }`);
  console.log('   the SAME PostHandler, unchanged. Watch the other terminal.\n');

  const split = await createApp({
    scan: await scanProject(import.meta.dirname),
    createContainer,
    // The whole topology statement. `search/` still sits on disk — it is scanned, so the
    // emitter knows its signature; it is simply not hosted here.
    remotes: { search: SEARCH },
    remoteTransport: createHttpTransport,
  });
  console.log(await publish(split, 'p2', 'A frond is a leaf that repeats itself'));
  await settle();

  console.log('\n\x1b[2m  Same emitter, two topologies. The fact found its listener both times.\x1b[0m\n');
  await together[Symbol.asyncDispose]?.();
  await split[Symbol.asyncDispose]?.();
}

main().catch((err) => { console.error(err); process.exit(1); });
