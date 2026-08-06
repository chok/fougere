/**
 * Fastify adapter — bridges a Fastify server to the HttpRouter interface.
 */
import type { HttpRouter, HttpMethod, RequestContext, ResponseResult, Middleware, Handler } from './router.js';

interface FastifyLike {
  addHook(hook: string, handler: Function): void;
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

function buildContext(req: any): RequestContext {
  const url = `${req.protocol ?? 'http'}://${req.hostname ?? 'localhost'}${req.url}`;
  const headers = new Headers(req.headers as Record<string, string>);
  const method = req.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const request = new Request(url, {
    method,
    headers,
    ...(hasBody && req.body ? { body: JSON.stringify(req.body) } : {}),
  });

  return {
    request,
    method: method as HttpMethod,
    path: req.url,
    params: req.params ?? {},
    query: req.query ?? {},
    body: async () => req.body ?? {},
    state: {},
  };
}

function sendResponse(reply: any, result: ResponseResult): void {
  if (result.headers) {
    for (const [k, v] of Object.entries(result.headers)) {
      // Fastify handles arrays natively (multiple headers)
      reply.header(k, v);
    }
  }
  // `raw` needs no branch here: fastify serializes a string as-is and an object as JSON,
  // and the content-type rides in `headers` — the producer states it, we do not guess.
  reply.status(result.status).send(result.data);
}

/**
 * Create an HttpRouter backed by a Fastify server.
 *
 * ```ts
 * import Fastify from 'fastify'
 * import { createFastifyRouter } from '@fougere/http'
 *
 * const fastify = Fastify()
 * const router = createFastifyRouter(fastify)
 * ```
 */
export function createFastifyRouter(server: FastifyLike): HttpRouter {
  const globalMiddlewares: Middleware[] = [];
  const scopedMiddlewares: Array<{ path: string; mw: Middleware }> = [];

  // Run matching middlewares as an onion chain around the handler
  function runMiddlewares(
    ctx: RequestContext,
    handler: Handler,
  ): Promise<ResponseResult> {
    const matching = [
      ...globalMiddlewares,
      ...scopedMiddlewares
        .filter((s) => ctx.path.startsWith(s.path))
        .map((s) => s.mw),
    ];

    let index = 0;
    const next = (): Promise<ResponseResult> => {
      if (index < matching.length) {
        return matching[index++](ctx, next);
      }
      return handler(ctx);
    };
    return next();
  }

  return {
    use(...args: [Middleware] | [string, Middleware]): void {
      const [pathOrMw, maybeMw] = args;
      if (typeof pathOrMw === 'string') {
        // Strip trailing /* — Fastify adapter uses startsWith for prefix matching
        const normalizedPath = pathOrMw.replace(/\/\*$/, '');
        scopedMiddlewares.push({ path: normalizedPath, mw: maybeMw as Middleware });
      } else {
        globalMiddlewares.push(pathOrMw as Middleware);
      }
    },

    on(method: HttpMethod, path: string, handler: Handler): void {
      const m = METHOD_MAP[method];
      server[m](path, async (req: any, reply: any) => {
        const ctx = buildContext(req);
        const result = await runMiddlewares(ctx, handler);
        sendResponse(reply, result);
      });
    },
  };
}
