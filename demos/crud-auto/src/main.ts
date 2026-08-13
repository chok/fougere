/**
 * Demo: Entity → CRUD auto-generated, one server, both surfaces.
 *
 * AuthorHandler extends Crud and overrides create; PostHandler adds custom ops.
 * Zero SQL, zero services, zero resolvers — and now zero schema wiring: what this
 * app serves is declared in `fougere.config.ts`, and Hono mounts the doors.
 *
 * Hono hands a standard Web `Request`, so it uses `@fougere/app/web` exactly as the
 * Next, TanStack, React Router and SvelteKit demos do. It needs no adapter package.
 */
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { fougereRest, fougereGraphQL } from '@fougere/app/web';
import { useFougereApp } from '@fougere/app';
import { generateRoutes } from '@fougere/adapter-rest';

const app = await useFougereApp();

// --- One server, both doors ---------------------------

const hono = new Hono();
hono.all('/api/*', (c) => fougereRest(c.req.raw));
hono.post('/graphql', (c) => fougereGraphQL(c.req.raw));

// The printed table below is the only reason this is called directly. `as never` is
// the same cast `@fougere/app/rest.ts:47` already carries: core's `App` and
// schema-rest's structural `AppLike` disagree on `HandlerEntry.ctor`, and a projection
// package is structurally typed on purpose so the two drifted. Not introduced here —
// only made visible, because this demo's typecheck now covers src/ and used not to.
const routes = generateRoutes(app as never, { prefix: '/api' });

const port = Number(process.env.PORT ?? 4000);
serve({ fetch: hono.fetch, port });
const url = `http://localhost:${port}`;

// --- Output -------------------------------------------

console.log(`
  Fougere — Single server demo (REST + GraphQL on Hono)

  GraphQL:  ${url}/graphql
  REST:     ${url}/api/{frond}/{plural}

  Same handlers, one server, zero duplication — and zero wiring: adapters in
  fougere.config.ts says what is served, the two lines above only mount the doors.

  --- GraphQL -----------------------------------------

  POST ${url}/graphql
  mutation { createAuthor(input: { name: "Alice", email: "alice@fougere.dev" }) { id name email } }
  mutation { createPost(input: { authorId: "<id>", title: "Hello", body: "World" }) { id title } }

  # Paginated list — total is lazy (COUNT only if requested)
  query { authors(limit: 10) { items { id name email } total hasMore } }
  query { posts(limit: 5, page: 2) { items { id title } total endCursor hasMore } }
  query { posts(after: "<cursor>", limit: 10, orderBy: "createdAt", order: "desc") { items { id title } hasMore endCursor } }

  --- REST --------------------------------------------

  GET    ${url}/api/blog/authors
  GET    ${url}/api/blog/authors/:id
  POST   ${url}/api/blog/authors         { "name": "Alice", "email": "alice@fougere.dev" }
  GET    ${url}/api/blog/posts
  GET    ${url}/api/blog/posts?limit=10&page=2
  POST   ${url}/api/blog/posts           { "authorId": "<id>", "title": "Hello", "body": "World" }
  PUT    ${url}/api/blog/posts/:id       { "title": "Updated" }
  DELETE ${url}/api/blog/posts/:id
  GET    ${url}/api/blog/posts/search-by-title?title=Hello
  POST   ${url}/api/blog/posts/publish   { "id": "<post-id>" }
`);

console.log('  Routes auto-generated:');
for (const r of routes) {
  console.log(`    ${r.method.padEnd(7)} ${r.path}`);
}
console.log();
