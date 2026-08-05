/**
 * Framework-agnostic route registration — translates RouteDefinition[] into HttpRouter calls.
 */
import type { HttpRouter } from '@fougere/http';
import { toHttpError } from '@fougere/core';
import { encodeFields, type Fields } from '@fougere/schema';
import type { RouteDefinition } from './routes.js';

/** Egress: encode a result (single object or array) into wire form against its output fields. */
function encodeOutput(result: unknown, fields: Fields): unknown {
  if (Array.isArray(result)) {
    return result.map((item) =>
      item && typeof item === 'object' ? encodeFields(fields, item as Record<string, unknown>) : item,
    );
  }
  if (result && typeof result === 'object') {
    return encodeFields(fields, result as Record<string, unknown>);
  }
  return result;
}

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

        if (result === undefined || result === null) {
          return { status: 404, data: { error: 'Not found' } };
        }
        if (result === true) {
          return { status: 204, data: null };
        }
        if (result === false) {
          return { status: 404, data: { error: 'Not found' } };
        }

        // The computed fields are already here: the façade applies the presenter on every
        // door (`presentEgress`), so a route that re-applied it did the work twice — and
        // once a computed field started receiving the PAGE rather than one row, the second
        // pass handed it a single object and threw `posts.map is not a function`.

        // Egress: encode domain values → wire (Date → ISO, money cents → decimal, …).
        // Convention applied once at the boundary; computed fields pass through untouched.
        const data = route.outputFields ? encodeOutput(result, route.outputFields) : result;

        return {
          status: route.method === 'POST' ? 201 : 200,
          data,
        };
      } catch (err) {
        const { status, body } = toHttpError(err);
        return { status, data: body };
      }
    });
  }
}
