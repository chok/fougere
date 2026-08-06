/**
 * Hono adapter — bridges a Hono app to the HttpRouter interface.
 */
import { MalformedJsonError, type HttpRouter, type HttpMethod, type RequestContext, type ResponseResult, type Middleware, type Handler } from './router.js';

interface HonoLike {
  use(path: string, ...handlers: Function[]): void;
  use(...handlers: Function[]): void;
  get(path: string, handler: Function): void;
  post(path: string, handler: Function): void;
  put(path: string, handler: Function): void;
  patch(path: string, handler: Function): void;
  delete(path: string, handler: Function): void;
}

const METHOD_MAP: Record<HttpMethod, 'get' | 'post' | 'put' | 'patch' | 'delete'> = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  PATCH: 'patch',
  DELETE: 'delete',
};

function buildContext(c: any): RequestContext {
  // Reuse state across middleware/handler calls within the same request
  const state = c.get('_fougereState') ?? {};
  c.set('_fougereState', state);
  return {
    request: c.req.raw,
    method: c.req.method.toUpperCase() as HttpMethod,
    path: c.req.path,
    params: c.req.param() ?? {},
    query: c.req.query() ?? {},
    body: async () => {
      const method = c.req.method.toUpperCase();
      const contentType = c.req.header?.('content-type') ?? c.req.raw?.headers?.get?.('content-type') ?? '';
      if (method === 'GET' || method === 'HEAD' || !contentType.toLowerCase().includes('json')) return {};
      try {
        return await c.req.json();
      } catch (cause) {
        throw new MalformedJsonError({ cause });
      }
    },
    state,
  };
}

function sendResponse(c: any, result: ResponseResult): Response {
  if (result.headers) {
    for (const [k, v] of Object.entries(result.headers)) {
      if (Array.isArray(v)) {
        for (const item of v) c.header(k, item, { append: true });
      } else {
        c.header(k, v);
      }
    }
  }
  if (result.data === undefined || result.data === null) {
    return c.body(null, result.status);
  }
  if (result.raw) {
    return c.body(result.data, result.status);
  }
  return c.json(result.data, result.status);
}

function malformedJsonResponse(c: any): Response {
  return sendResponse(c, { status: 400, data: { code: 'BAD_REQUEST', message: 'Malformed JSON body' } });
}

/**
 * Create an HttpRouter backed by a Hono app.
 *
 * ```ts
 * import { Hono } from 'hono'
 * import { createHonoRouter } from '@fougere/http'
 *
 * const hono = new Hono()
 * const router = createHonoRouter(hono)
 * ```
 */
export function createHonoRouter(app: HonoLike): HttpRouter {
  return {
    use(...args: [Middleware] | [string, Middleware]): void {
      const [pathOrMw, maybeMw] = args;
      const path = typeof pathOrMw === 'string' ? pathOrMw : undefined;
      const mw: Middleware = (typeof pathOrMw === 'function' ? pathOrMw : maybeMw) as Middleware;

      const honoMiddleware = async (c: any, next: Function) => {
        try {
          const ctx = buildContext(c);
          const result = await mw(ctx, async () => {
            await next();
            // After next(), Hono has already set the response — return a passthrough
            return { status: c.res.status, data: null };
          });
          // If the middleware returned a custom response (short-circuit), send it
          if (result.data !== null) {
            return sendResponse(c, result);
          }
        } catch (err) {
          if (err instanceof MalformedJsonError) return malformedJsonResponse(c);
          throw err;
        }
      };

      if (path) {
        // Hono requires /* suffix for prefix matching on middleware
        const honoPath = path.endsWith('/*') ? path : `${path}/*`;
        app.use(honoPath, honoMiddleware);
      } else {
        app.use(honoMiddleware);
      }
    },

    on(method: HttpMethod, path: string, handler: Handler): void {
      const m = METHOD_MAP[method];
      app[m](path, async (c: any) => {
        const ctx = buildContext(c);
        try {
          const result = await handler(ctx);
          return sendResponse(c, result);
        } catch (err) {
          if (err instanceof MalformedJsonError) return malformedJsonResponse(c);
          throw err;
        }
      });
    },
  };
}
