/**
 * Framework-agnostic route registration — translates RouteDefinition[] into HttpRouter calls.
 */
import type { HttpRouter } from '@fougere/http';
import { answer } from './answer.js';
import type { RouteDefinition } from './routes/RouteDefinition.js';

/** Register all route definitions on an HttpRouter. */
export function registerRoutes(
  router: HttpRouter,
  routes: RouteDefinition[],
): void {
  for (const route of routes) {
    router.on(route.method, route.path, async (ctx) => answer(route, {
      params: ctx.params,
      query: ctx.query,
      input: await ctx.body(),
      state: ctx.state,
    }));
  }
}
