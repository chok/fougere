/**
 * Standalone GraphQL server — same fronds as Nuxt, different surface.
 *
 * Usage: pnpm graphql
 */
import { boot, loggerMiddleware, errorMiddleware, type Logger } from '@fougere/core';
import { createContainer } from '@fougere/container-fougere';
import { setupSqlite, migrate } from '@fougere/schema-sql';
import { registerAll, registerGraphQL } from '@fougere/schema-graphql';
import { createHonoRouter, httpLogger } from '@fougere/http';
import SchemaBuilder from '@pothos/core';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const app = await boot({
  root: import.meta.dirname,
  createContainer,
  db: () => {
    const { db, ormFactory } = setupSqlite({ path: ':memory:' });
    return { db, ormFactory, afterBoot: (app) => migrate(app, db) };
  },
});

// Admin schema — full entity fields
const adminBuilder = new SchemaBuilder({});
adminBuilder.queryType({});
adminBuilder.mutationType({});
registerAll(adminBuilder, app);

// Public schema — restricted output (no email, no body)
const publicBuilder = new SchemaBuilder({});
publicBuilder.queryType({});
publicBuilder.mutationType({});
registerAll(publicBuilder, app, { surface: 'public' });

// Middlewares
const logger = app.resolve<Logger>('Logger');
app.use(loggerMiddleware(logger));
app.use(errorMiddleware());

const hono = new Hono();
const router = createHonoRouter(hono);
router.use(httpLogger(logger.child('http')));
registerGraphQL(router, adminBuilder.toSchema(), { path: '/graphql' });
registerGraphQL(router, publicBuilder.toSchema(), { path: '/graphql/public' });

const port = 4000;
serve({ fetch: hono.fetch, port });

console.log(`\n  🌿 Fougere GraphQL — two surfaces\n`);
console.log(`  Admin:   http://localhost:${port}/graphql`);
console.log(`  Public:  http://localhost:${port}/graphql/public\n`);
