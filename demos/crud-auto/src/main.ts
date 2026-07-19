/**
 * Demo: Entity -> CRUD auto-generated, single server (REST + GraphQL).
 *
 * AuthorHandler: extends Crud, overrides create.
 * PostHandler: full CRUD + custom ops (searchByTitle, publish).
 * Zero SQL, zero services, zero resolvers.
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createContainer } from '@fougere/container-fougere';
import { createApp } from '@fougere/core';
import { createOrmFactory, autoMigrate } from '@fougere/schema-drizzle';
import { registerAll, registerGraphQL } from '@fougere/schema-graphql';
import { generateRoutes, registerRoutes } from '@fougere/schema-rest';
import { createHonoRouter } from '@fougere/http';
import SchemaBuilder from '@pothos/core';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { join } from 'node:path';

// --- DB -----------------------------------------------

const sqlite = new Database(':memory:');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

const db = drizzle(sqlite);

// --- Bootstrap ----------------------------------------

const app = await createApp({
  root: join(import.meta.dirname, '..'),
  createContainer,
  ormFactory: createOrmFactory(db),
});

// Auto-create tables from scanned entities
autoMigrate(app, sqlite);

// --- GraphQL schema (auto-generated) ------------------

const builder = new SchemaBuilder({});
builder.queryType({});
builder.mutationType({});

registerAll(builder, app);

const schema = builder.toSchema();

// --- Single Hono server: REST + GraphQL ---------------

const hono = new Hono();
const router = createHonoRouter(hono);

// REST routes
const routes = generateRoutes(app, { prefix: '/api' });
registerRoutes(router, routes);

// GraphQL endpoint
registerGraphQL(router, schema);

const port = Number(process.env.PORT ?? 4000);
serve({ fetch: hono.fetch, port });
const url = `http://localhost:${port}`;

// --- Output -------------------------------------------

console.log(`
  Fougere — Single server demo (REST + GraphQL on Hono)

  GraphQL:  ${url}/graphql
  REST:     ${url}/api

  Same handlers, one server, zero duplication.

  --- GraphQL -----------------------------------------

  POST ${url}/graphql
  mutation { createAuthor(input: { name: "Alice", email: "alice@fougere.dev" }) { id name email } }
  mutation { createPost(input: { authorId: "<id>", title: "Hello", body: "World" }) { id title } }

  # Paginated list — total is lazy (COUNT only if requested)
  query { authors(limit: 10) { items { id name email } total hasMore } }
  query { posts(limit: 5, page: 2) { items { id title } total endCursor hasMore } }
  query { posts(after: "<cursor>", limit: 10, orderBy: "createdAt", order: "desc") { items { id title } hasMore endCursor } }

  --- REST --------------------------------------------

  GET    ${url}/api/authors
  GET    ${url}/api/authors/:id
  POST   ${url}/api/authors         { "name": "Alice", "email": "alice@fougere.dev" }
  GET    ${url}/api/posts
  GET    ${url}/api/posts?limit=10&page=2
  POST   ${url}/api/posts           { "authorId": "<id>", "title": "Hello", "body": "World" }
  PUT    ${url}/api/posts/:id       { "title": "Updated" }
  DELETE ${url}/api/posts/:id
  GET    ${url}/api/posts/search-by-title?title=Hello
  POST   ${url}/api/posts/publish   { "id": "<post-id>" }
`);

console.log('  Routes auto-generated:');
for (const r of routes) {
  console.log(`    ${r.method.padEnd(7)} ${r.path}`);
}
console.log();
