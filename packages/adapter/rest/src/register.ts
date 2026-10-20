/**
 * Framework-agnostic route registration — translates RouteDefinition[] into HttpRouter calls.
 */
import { answerAt, type Answering } from '@fougere/core';
import type { HttpRouter } from '@fougere/http';
import { restDoor } from './door.js';
import { describedAt } from './openapi/described.js';
import { prefixOf } from './RestProtocol.js';
import type { AppLike, RouteDefinition } from './routes/RouteDefinition.js';

export interface RegisterOptions {
  /** The app's cycle, which watches each request — `app.answer`. Without it the door runs unwatched. */
  answer?: Answering;
}

/** Register all route definitions on an HttpRouter. */
export function registerRoutes(
  router: HttpRouter,
  routes: RouteDefinition[],
  { answer = answerAt }: RegisterOptions = {},
): void {
  for (const route of routes) {
    router.on(route.method, route.path, (ctx) => answer(restDoor(route), {
      operation: route.operationName,
      headers: ctx.request.headers,
      params: ctx.params,
      query: ctx.query,
      body: () => ctx.body(),
      state: ctx.state,
    }));
  }
}

/** What REST publishes of itself, on a router — nothing unless `protocols: { rest: { openapi: true } }`. */
export function registerDescribed(router: HttpRouter, app: AppLike): void {
  if (app.protocols?.rest?.openapi !== true) return;
  for (const path of ['/openapi.json', '/docs'].map((tail) => prefixOf(app.protocols) + tail)) {
    router.on('GET', path, async () => describedAt(app, 'GET', path)!);
  }
}
