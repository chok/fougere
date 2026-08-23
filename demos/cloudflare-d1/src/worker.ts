/**
 * A Fougere app on Cloudflare Workers — same declaration, no disk, no socket.
 *
 * Three things a Node process gets for free have to be stated here, and they are the
 * whole of what is Cloudflare-shaped in this demo:
 *
 *  1. THE SCAN arrives as a module `fougere build` wrote. Producing it read the project;
 *     consuming it reads nothing, which is why `createApp` runs where `node:fs` does not.
 *  2. THE STORAGE arrives as a BINDING, read from `cloudflare:workers` at MODULE scope.
 *     That placement is the whole difference between two budgets: work done inside
 *     `fetch` counts against the request's CPU allowance (10 ms on the free plan), work
 *     done at module load counts as STARTUP time, which is far larger. Measured before
 *     the move: a cold isolate answered in 12–23 ms of CPU and a warm one in 1 ms.
 *  3. THE DOORS are `receive` (the JSON-RPC envelope, taking a `Request`) and the REST
 *     projection on hono. `serve()` is the node:http realization of the first and stays
 *     where it is; hono needs no bridge here because a Worker already speaks `Request`.
 *
 * The frond under `fronds/` is ordinary. Nothing in it names Cloudflare.
 */
import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { createApp, createLocalRunner, type App } from '@fougere/core';
import { observability, flushTelemetry } from '@fougere/observability';
import { createContainer } from '@fougere/container';
import { receive } from '@fougere/transport-http/receive';
import { createHonoRouter } from '@fougere/http';
import { generateRoutes, registerRoutes } from '@fougere/adapter-rest';
import { setupKysely } from '@fougere/adapter-sql';
import { D1Dialect } from 'kysely-d1';
import { scan } from '../.fougere/scan.generated.js';

interface Env {
  DB: D1Database;
}

async function open(env: Env) {
  // D1 IS SQLite, so the dialect Fougere reasons with is `'sqlite'` — the DDL, the
  // codecs and the binding limit are the ones it already knows. What is different is
  // the driver, and `setupKysely` exists exactly so this package chooses none.
  const storage = setupKysely(new D1Dialect({ database: env.DB }), 'sqlite');
  // No `otlp:` — an exporter buffers and flushes on a timer, and an isolate is frozen
  // the moment it answers. Without one the extension still measures and still serves
  // `rpc.topology`; what it cannot do is push, and that wants `ctx.waitUntil`.
  const app: App = await createApp({
    scan,
    createContainer,
    ormFactory: storage.ormFactory,
    extensions: [observability({
      service: 'catalog',
      // The collector next door. Its exporter still buffers on a timer — which never
      // fires here — so the flush below is what actually sends.
      otlp: 'https://fougere-telemetry.maxime-picaud-240.workers.dev',
      // No timer: Cloudflare refuses a deployment whose module scope sets one, and an
      // isolate is frozen at the response anyway. `ctx.waitUntil` below is what sends.
      flushMs: 0,
    })],
  });

  // Said out loud: this demo has no root key, so the envelope door takes the `state` a
  // caller hands it. A deployment that splits fronds across Workers wires `verify`
  // instead — `fougere keys` / `fougere grant`, and the three env vars as secrets.
  const envelope = receive(createLocalRunner(app), { allowUnsigned: true });
  const hono = new Hono();
  registerRoutes(createHonoRouter(hono), generateRoutes(app as never, { prefix: '/api' }));
  hono.get('/', (c) => c.html(landing(app)));

  // The envelope keeps its own path rather than becoming a hono route: it is a wire
  // contract a peer calls, not a surface a browser walks, and the two must not drift.
  // `hono.fetch` may answer synchronously; the awaited form is what makes one signature.
  return async (request: Request): Promise<Response> =>
    new URL(request.url).pathname === '/_fougere/call' ? envelope(request) : hono.fetch(request);
}

/**
 * Booted at module load, not on the first request.
 *
 * A top-level await is what moves the cost across the budget line. The isolate is not
 * serving anything yet, so nothing waits on this — and every request, the first one
 * included, meets an app that is already up.
 */
const door = await open(env as unknown as Env);

export default {
  async fetch(request: Request, _env: Env, ctx: { waitUntil(work: Promise<unknown>): void }): Promise<Response> {
    const answer = await door(request);
    // The isolate is frozen the moment this returns, so an exporter's timer never fires
    // and the window it held is lost. `waitUntil` is the platform saying "this work
    // outlives the response" — the one place a Worker can send what it measured.
    ctx.waitUntil(flushTelemetry().catch(() => {}));
    return answer;
  },
};

/** What is served, read off the app itself — never a list written twice. */
function landing(app: App): string {
  const rows = app.fronds.flatMap((frond) =>
    frond.handlers.map((handler) => `<li><code>${frond.name}</code> — <code>${handler.address}</code>
      · <a href="/api/${handler.address}s">/api/${handler.address}s</a></li>`),
  );
  return `<!doctype html><meta charset=utf-8><title>Fougere on Workers</title>
<style>body{font:16px/1.6 ui-sans-serif,system-ui;max-width:44rem;margin:4rem auto;padding:0 1.5rem}
code{background:#f4f4f5;padding:.1em .35em;border-radius:.25em}
@media(prefers-color-scheme:dark){body{background:#111;color:#eee}code{background:#27272a}a{color:#7dd3fc}}</style>
<h1>Fougere on Cloudflare Workers</h1>
<p>One declaration, no filesystem, no compatibility flag. Rows live in D1.</p>
<ul>${rows.join('')}</ul>
<p>The JSON-RPC envelope answers on <code>POST /_fougere/call</code>, and
<code>{"method":"rpc.discover"}</code> returns the whole identity card.</p>`;
}
