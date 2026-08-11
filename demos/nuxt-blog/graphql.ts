/**
 * Standalone GraphQL server — the same fronds as the Nuxt app, a different surface.
 *
 * What this file no longer contains is the point. It used to build two Pothos
 * builders, declare their root types and call `registerAll` on each; all of that was
 * convention, so `adapters: { graphql: true }` in fougere.config.ts replaced it.
 *
 * It also proves something the old version could not: this process reads the app's
 * own topology, and `remotes: { blog: … }` is declared there — so the schema it
 * serves is built over a frond running in ANOTHER process. Start `pnpm dev:blog`
 * first, or nothing answers.
 *
 * ## One audience, not two
 *
 * The previous version also served `/graphql/public`, a restricted schema for the
 * `public` surface. That cannot work here and the framework says so: a named surface
 * resolves in the local container only, so a consumer cannot expose a restricted view
 * of a REMOTE frond (`core/src/bootstrap.ts`, `facadeFor` — a known limitation, whose
 * coherent answer is composition and is not shipped). Serving it anyway produced an
 * empty schema: `Type Query must define one or more fields`. It is left out rather
 * than left broken.
 *
 * Usage: pnpm dev:blog, then pnpm graphql
 */
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { fougereGraphQL } from '@fougere/app/web';

// Hono hands a standard Web `Request`, so the door goes in unchanged — the same
// reason the TanStack, React Router and SvelteKit demos need no adapter package.
const hono = new Hono();
hono.post('/graphql', (c) => fougereGraphQL(c.req.raw));

const port = 4000;
serve({ fetch: hono.fetch, port });

console.log(`\n  🌿 Fougere GraphQL — zero schema wiring\n`);
console.log(`  POST http://localhost:${port}/graphql`);
console.log(`  Serving the blog frond over JSON-RPC — pnpm dev:blog must be running.\n`);
