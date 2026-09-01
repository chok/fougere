/**
 * Remote blog server — standalone frond running as its own service.
 *
 * Exposes:
 * - REST CRUD on /api/posts, /api/authors
 * - POST /_fougere/call — the envelope, which answers `rpc.discover` with the
 *   identity card `fougere sync` reads. One discovery surface, not two: a
 *   dedicated GET used to publish every entity, façade or not.
 */
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createApp, createLocalRunner } from '@fougere/core';
import { scanProject, setModuleLoader, frondAliases } from '@fougere/core/node';
import { createContainer } from '@fougere/container';
import { createHonoRouter } from '@fougere/http';
import { handleRpc } from '@fougere/transport-http';
import { generateRoutes, registerRoutes } from '@fougere/adapter-rest';
import { createMemoryStorage } from '@fougere/adapter-memory';

const PORT = Number(process.env.PORT ?? 4001);

async function main() {
  // Boot fougere with in-memory storage
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    // `@fronds/<name>` is how a frond names its neighbour; the loader has to know it.
    alias: await frondAliases(import.meta.dirname),
  });
  setModuleLoader((p) => jiti.import(p) as Promise<Record<string, unknown>>);

  const app = await createApp({
    scan: await scanProject(import.meta.dirname),
    createContainer,
    storageFactory: createMemoryStorage,
  });

  // HTTP
  const hono = new Hono();
  const router = createHonoRouter(hono);

  // REST routes
  const routes = generateRoutes(app, { prefix: '/api' });
  registerRoutes(router, routes);

  // The envelope — same wire as process-to-process, and the surface `fougere sync`
  // reads (rpc.discover).
  const runner = createLocalRunner(app);
  hono.post('/_fougere/call', async (c) => c.json(await handleRpc(runner, await c.req.json()) as never));

  // Seed some data
  const postHandler = app.resolve<Record<string, Function>>('postHandler');
  const ctx = (body: Record<string, unknown>) => ({ params: {}, query: {}, body, state: {} });
  await postHandler.create(ctx({ title: 'Hello from remote blog', body: 'This post lives on a separate server.', views: 0 }));
  await postHandler.create(ctx({ title: 'Second post', body: 'Another one.', views: 42 }));

  serve({ fetch: hono.fetch, port: PORT }, () => {
    console.log('');
    console.log('  \x1b[32m\uD83C\uDF3F fougere\x1b[0m  remote-blog');
    console.log('');
    console.log(`  \x1b[2m\u279C\x1b[0m  REST     http://localhost:${PORT}/api/posts`);
    console.log(`  \x1b[2m\u279C\x1b[0m  Call     http://localhost:${PORT}/_fougere/call  (rpc.discover)`);
    console.log('');
  });
}


main();
