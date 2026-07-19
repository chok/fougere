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

/** Apply presenter computed fields to a result (single object or array). */
async function applyPresenter(
  result: unknown,
  presenter: Record<string, (parent: any) => any>,
  fieldNames: string[],
): Promise<unknown> {
  const enrich = async (item: Record<string, unknown>) => {
    const enriched = { ...item };
    for (const name of fieldNames) {
      if (typeof presenter[name] === 'function') {
        enriched[name] = await presenter[name](item);
      }
    }
    return enriched;
  };

  if (Array.isArray(result)) {
    return Promise.all(result.map(enrich));
  }
  if (result && typeof result === 'object') {
    return enrich(result as Record<string, unknown>);
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

        // Apply presenter computed fields
        const enriched = route.presenter && route.presenterFieldNames
          ? await applyPresenter(result, route.presenter, route.presenterFieldNames)
          : result;

        // Egress: encode domain values → wire (Date → ISO, money cents → decimal, …).
        // Convention applied once at the boundary; computed fields pass through untouched.
        const data = route.outputFields ? encodeOutput(enriched, route.outputFields) : enriched;

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
