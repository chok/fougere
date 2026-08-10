/**
 * The three doors, on an `HttpRouter`.
 *
 * This is the piece that was missing, and its absence was visible: `@fougere/http`
 * defined a neutral router with Hono and Fastify adapters, but only the GraphQL
 * projection ever mounted anything through it. So the repo had two server seams —
 * `HttpRouter` and `@fougere/app/web` — and no consumer that used the first for the
 * envelope or REST. Adding Express is what made that gap load-bearing.
 *
 * `serveRpc` and `serveRest` decide; this file only maps a `RequestContext` onto a
 * `DoorRequest`, which is the same mapping the Web handlers do from a `Request`.
 * Nothing here goes through `Request`, on purpose: Express hands a Node stream, so
 * a router-mounted door must be able to read a body without one.
 */
import type { Handler, HttpRouter, RequestContext, ResponseResult } from '@fougere/http';
import { useFougereApp } from './boot.js';
import { serveRest, serveRpc, rpcParseError } from './serve.js';
import { sessionViewOf } from './session.js';

export interface MountOptions {
  /**
   * Where the REST projection listens, spelled in the HOST's own wildcard syntax —
   * `/api/*` for Hono and Fastify, `/api/*splat` for Express 5. Stated by the caller
   * because it belongs to the framework, not to us; guessing it is how an adapter
   * ends up working on one host and silently not on another.
   */
  restPath?: string;
  /** Where the call envelope listens. Defaults to the path the browser client knows. */
  callPath?: string;
  /** Where the session view listens. Same default reason as `callPath`. */
  sessionPath?: string;
}

function doorRequestOf(ctx: RequestContext, path: string) {
  return {
    method: ctx.method,
    path,
    query: ctx.query,
    state: ctx.state,
  };
}

/**
 * Mount the call envelope, the session view and the REST projection on any router.
 *
 * ```ts
 * const router = createExpressRouter(app)
 * mountDoors(router, { restPath: '/api/*splat' })
 * ```
 *
 * Additive by construction: the router registers these paths and touches nothing
 * else, so an app that already serves `/api/whatever` keeps serving it — its own
 * route is registered before this catch-all and wins.
 */
export function mountDoors(router: HttpRouter, options: MountOptions = {}): void {
  const callPath = options.callPath ?? '/_fougere/call';
  const restPath = options.restPath ?? '/api/*';

  const call: Handler = async (ctx): Promise<ResponseResult> => {
    const app = await useFougereApp();
    let body: unknown;
    try {
      body = await ctx.body();
    } catch {
      return { status: 200, data: rpcParseError() };
    }
    // The path carries the audience — `/_fougere/call/public` selects the `public`
    // surface, and `surfaceOf` reads it inside `serveRpc`.
    return { status: 200, data: await serveRpc(app, { path: ctx.path, body, state: ctx.state }) };
  };

  router.on('POST', callPath, call);
  router.on('POST', `${callPath}/:surface`, call);

  router.on('GET', options.sessionPath ?? '/_fougere/session', async (ctx) => ({
    status: 200,
    data: sessionViewOf(ctx.state),
  }));

  const rest: Handler = async (ctx): Promise<ResponseResult> => {
    const app = await useFougereApp();
    const outcome = await serveRest(app, {
      ...doorRequestOf(ctx, ctx.path.replace(/^\/api\//, '')),
      body: await ctx.body(),
    });

    if (outcome.kind === 'pass') {
      return { status: 404, data: { message: `No route for ${ctx.method} ${ctx.path}` } };
    }
    if (outcome.kind === 'error') {
      return { status: outcome.status, data: outcome.body, ...(outcome.headers ? { headers: outcome.headers } : {}) };
    }
    return { status: outcome.status, data: outcome.body };
  };

  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const) {
    router.on(method, restPath, rest);
  }
}
