/**
 * The blog Frond, alone in its process — the gradient lived.
 *
 * Same `fronds/**` as the Nuxt app: only the runtime moves. The address is declared
 * ONCE, in `fougere.config.ts` under `remotes:`, and this process binds exactly what
 * the consumer was told to call. Writing the port here too put one number in two
 * files, and nothing made them agree.
 */
import { createJiti } from 'jiti';
import { createLocalRunner, Logger, serves } from '@fougere/core';
import { bootApp } from '@fougere/defaults';
import { frondAliases, setModuleLoader, loadConfig, remotesOf } from '@fougere/core/node';
import { prefixOf } from '@fougere/adapter-rest';
import { serve } from '@fougere/transport-http';
import { answer } from '@fougere/app/answer';
import { calls } from '@fougere/calls';
import { observability } from '@fougere/observability';

// `frondAliases` is what makes `@fronds/user/entities/User.js` resolve — the named
// form a frond uses for its neighbour. Without it this entry point loaded frond
// sources through a bare jiti, and `CurrentUserCollector` died on that import
// while the very same code worked in-process under Nuxt.
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  alias: await frondAliases(process.cwd()),
});
setModuleLoader((filePath: string) => jiti.import(filePath) as Promise<Record<string, unknown>>);

// Commenting the address is how you take the frond back in-process, so its absence means
// this process has no caller — say that rather than binding a port nobody dials.
const config = await loadConfig(process.cwd());
const address = remotesOf(config).blog;
if (!address) {
  throw new Error(
    "No address for 'blog' in fougere.config.ts — `fronds: { blog: 'http://…' }` is what sends calls here.\n"
    + '  Uncomment it to run the frond split, or drop this process and run the app in-process.',
  );
}
const { hostname, port: declaredPort } = new URL(address);

const log = new Logger('blog-host');

// Booted the way `fougere serve blog` boots it — the whole `fougere.config.ts`, its sources,
// protocols and statement — so nothing it says is copied here. Writing `createApp` by hand once left
// `protocols:` behind, and the REST door answered 404 everywhere while this file said it served it.
// What this process adds is its own: the panel, on a loopback port, shows every call this frond
// executes, the ones that arrived over the wire included — the half a browser's devtools cannot show.
const app = await bootApp(process.cwd(), {
  only: ['blog'],
  extensions: [observability({ service: 'blog-host' }), calls({ panel: 4400 })],
});

// Its REST door comes with it: split, `/api/blog/…` is answered here and no longer by Nuxt.
const beside = (request: Request) => answer(app, request);
const { port } = await serve(createLocalRunner(app), {
  port: Number(declaredPort), host: hostname, beside, answer: (door, received) => app.answer(door, received),
});
const rest = serves(app.protocols, 'rest') ? `, REST ${new URL(`${prefixOf(app.protocols)}/blog`, address).href}` : '';
log.info(`frond blog served — POST ${new URL('/_fougere/call', address).href}${rest} (bound :${port})`);
