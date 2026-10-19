/**
 * Framework-agnostic route registration — translates RouteDefinition[] into HttpRouter calls.
 */
import { answerAt, type Answering } from '@fougere/core';
import type { HttpRouter } from '@fougere/http';
import { restDoor } from './door.js';
import type { RouteDefinition } from './routes/RouteDefinition.js';

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
      headers: ctx.request.headers,
      params: ctx.params,
      query: ctx.query,
      body: () => ctx.body(),
      state: ctx.state,
    }));
  }
}
