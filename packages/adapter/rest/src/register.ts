/**
 * Framework-agnostic route registration — translates RouteDefinition[] into HttpRouter calls.
 */
import type { HttpRouter } from '@fougere/http';
import { toHttpError } from '@fougere/core';
import type { RouteDefinition } from './routes.js';

/**
 * Register all route definitions on an HttpRouter.
 *
 * ```ts
 * const routes = generateRoutes(app, { prefix: '/api' });
 * registerRoutes(router, routes);
 * ```
 */
export function registerRoutes(
  router: HttpRouter,
  routes: RouteDefinition[],
): void {
  for (const route of routes) {
    router.on(route.method, route.path, async (ctx) => {
      const body = (await ctx.body()) as Record<string, unknown> | undefined;

      // Build unified InvocationContext for the binding algorithm
      const invocation = {
        params: ctx.params,
        query: ctx.query,
        body,
        state: ctx.state,
      };

      try {
        const result = await route.handler(invocation);

        if ((result === undefined || result === null) && route.operationName === 'findById') {
          return { status: 404, data: { error: 'Not found' } };
        }
        if (result === true && route.operationName === 'delete') {
          return { status: 204, data: null };
        }
        if (result === false && route.operationName === 'delete') {
          return { status: 404, data: { error: 'Not found' } };
        }

        // The computed fields are already here: the façade applies the presenter on every
        // door (`presentEgress`), so a route that re-applied it did the work twice — and
        // once a computed field started receiving the PAGE rather than one row, the second
        // pass handed it a single object and threw `posts.map is not a function`.

        return {
          status: route.successStatus ?? (route.operationName === 'create' ? 201 : 200),
          // The façade is the single egress boundary for every door. Re-encoding here
          // makes custom encoders run twice and makes REST disagree with the envelope.
          data: result,
        };
      } catch (err) {
        const { status, body } = toHttpError(err);
        return { status, data: body };
      }
    });
  }
}
