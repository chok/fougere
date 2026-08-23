/**
 * The one thing a build cannot write down: who carries a call to the other Worker.
 *
 * Cloudflare REFUSES a Worker fetching a sibling's public URL — measured, the edge
 * answers `error code: 1042` before the request leaves. So two Workers of one account
 * reach each other through a SERVICE BINDING and through nothing else, and a binding is
 * a live object that exists only in this process. The generated plugin states the scan
 * and the config, both known at build; this states the transport, which is not.
 *
 * NOT TYPECHECKED, and the repo's other consumer is not either: every name here is
 * Nuxt's — `defineNitroPlugin`, the auto-imported `extendFougere`, the `cloudflare:`
 * module — and none of them exists outside the scaffolding `nuxt prepare` writes, which
 * has no server tsconfig to extend in Nuxt 4.5. A frond needs none of that, which is why
 * `tsc -p fronds` works everywhere a frond exists and nowhere a consumer does.
 *
 * `extendFougere` and not `configureFougere`: the generated plugin already spoke, and
 * replacing its word would throw away the scan. It is auto-imported — the module calls
 * `addServerImportsDir` on its own server utils, which is how a bare name resolves here
 * when the package itself is not visible from this project under pnpm.
 */
import { defineNitroPlugin } from 'nitropack/runtime';
import { env } from 'cloudflare:workers';
import { createHttpTransport } from '@fougere/transport-http';

interface Bindings {
  CATALOG: { fetch: (request: Request) => Promise<Response> };
}

export default defineNitroPlugin(() => {
  const catalog = (env as unknown as Bindings).CATALOG;
  if (!catalog) return;

  extendFougere({
    // The URL still names the path (`/_fougere/call`); the binding decides the route.
    // Nothing else about the call changes — same envelope, same retries, same refusals.
    remoteTransport: (url) =>
      createHttpTransport(url, {
        fetch: (input, init) => catalog.fetch(new Request(input, init as RequestInit)),
      }),
  });
});
