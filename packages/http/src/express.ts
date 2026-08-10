/**
 * Express adapter — bridges an Express app to the HttpRouter interface.
 *
 * The one that is not Web-standard, and that is the whole substance of this file.
 * Hono hands over `c.req.raw`, Fastify parses the body for us; Express hands a
 * Node `IncomingMessage` and parses nothing unless the app happens to have mounted
 * `express.json()`. So the conversion lives here — read the stream when nobody
 * else did, and build the `Request` the interface promises.
 *
 * Working with or without `express.json()` is deliberate: an adapter that only
 * works when the host app is configured a particular way is a footgun, and this
 * one is meant to be dropped into an app that already exists.
 */
import { MalformedJsonError, type HttpRouter, type HttpMethod, type RequestContext, type ResponseResult, type Middleware, type Handler } from './router.js';

interface ExpressLike {
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

const MAX_BODY_BYTES = 1024 * 1024;

/** Drain the Node stream. Only reached when no body parser ran before us. */
function readRawBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let exceeded = false;
    req.on('data', (chunk: Buffer) => {
      if (exceeded) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        exceeded = true;
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on('end', () => { if (!exceeded) resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', reject);
  });
}

function buildContext(req: any): RequestContext {
  const host = req.headers?.host ?? 'localhost';
  const protocol = req.protocol ?? 'http';
  const url = `${protocol}://${host}${req.originalUrl ?? req.url}`;
  // Kept as a plain string: a real request may be HEAD or OPTIONS, which the
  // interface's `HttpMethod` does not name. Casting here would have made the
  // "does this verb carry a body" question unaskable — it is asked below.
  const verb: string = req.method.toUpperCase();
  const headers = new Headers(
    Object.entries(req.headers ?? {})
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );

  // Parsed once per request whoever asks: `body()` may be called by a middleware
  // and again by the handler, and a drained stream answers empty the second time.
  let parsed: Promise<unknown> | undefined;
  const body = (): Promise<unknown> => {
    parsed ??= (async () => {
      if (verb === 'GET' || verb === 'HEAD') return {};
      // `express.json()` already ran — trust it, including its own limits.
      if (req.body !== undefined && req.body !== null) return req.body;
      const contentType = String(req.headers?.['content-type'] ?? '');
      if (!contentType.toLowerCase().includes('json')) return {};
      const raw = await readRawBody(req);
      if (!raw) return {};
      try {
        return JSON.parse(raw);
      } catch (cause) {
        throw new MalformedJsonError({ cause });
      }
    })();
    return parsed;
  };

  return {
    // The Request carries no body: Express may have consumed the stream already,
    // and a Request built around a drained one lies. `body()` is the honest reader,
    // and it is what every consumer in this repo calls.
    request: new Request(url, { method: verb, headers }),
    method: verb as HttpMethod,
    path: req.path ?? (req.originalUrl ?? req.url ?? '').split('?')[0],
    params: req.params ?? {},
    query: Object.fromEntries(
      Object.entries(req.query ?? {}).map(([key, value]) => [key, String(Array.isArray(value) ? value[0] : value)]),
    ),
    body,
    state: {},
  };
}

function sendResponse(res: any, result: ResponseResult): void {
  if (result.headers) {
    for (const [key, value] of Object.entries(result.headers)) res.set(key, value);
  }
  res.status(result.status);
  // `raw` means "do not JSON-serialize" — `send` on a string writes it as-is, and
  // the content-type rides in `headers`, stated by the producer rather than guessed.
  if (result.raw) res.send(result.data);
  else res.json(result.data);
}

/**
 * Create an HttpRouter backed by an Express app.
 *
 * ```ts
 * import express from 'express'
 * import { createExpressRouter } from '@fougere/http'
 *
 * const app = express()
 * const router = createExpressRouter(app)
 * ```
 */
export function createExpressRouter(app: ExpressLike): HttpRouter {
  const globalMiddlewares: Middleware[] = [];
  const scopedMiddlewares: Array<{ path: string; mw: Middleware }> = [];

  // Run matching middlewares as an onion chain around the handler
  function runMiddlewares(ctx: RequestContext, handler: Handler): Promise<ResponseResult> {
    const matching = [
      ...globalMiddlewares,
      ...scopedMiddlewares.filter((s) => ctx.path.startsWith(s.path)).map((s) => s.mw),
    ];

    let index = 0;
    const next = (): Promise<ResponseResult> => {
      if (index < matching.length) return matching[index++](ctx, next);
      return handler(ctx);
    };
    return next();
  }

  return {
    use(...args: [Middleware] | [string, Middleware]): void {
      const [pathOrMw, maybeMw] = args;
      if (typeof pathOrMw === 'string') {
        // Strip a trailing /* — prefix matching here is `startsWith`, as in the
        // Fastify adapter, and Express 5 spells its own splat differently anyway.
        scopedMiddlewares.push({ path: pathOrMw.replace(/\/\*$/, ''), mw: maybeMw as Middleware });
      } else {
        globalMiddlewares.push(pathOrMw as Middleware);
      }
    },

    on(method: HttpMethod, path: string, handler: Handler): void {
      app[METHOD_MAP[method]](path, async (req: any, res: any, next: Function) => {
        try {
          sendResponse(res, await runMiddlewares(buildContext(req), handler));
        } catch (err) {
          // This adapter is the one that parses JSON, so it is the one that answers
          // for it — same 400 the Hono adapter gives, which is the other self-parsing
          // one. Fastify's own parser answers before we ever see the request.
          if (err instanceof MalformedJsonError) {
            sendResponse(res, { status: 400, data: { code: 'BAD_REQUEST', message: 'Malformed JSON body' } });
            return;
          }
          if ((err as { statusCode?: number })?.statusCode === 413) {
            sendResponse(res, { status: 413, data: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large' } });
            return;
          }
          // Anything else goes to Express's error pipeline rather than crashing the
          // process — an app that already has an error handler keeps using it.
          next(err);
        }
      });
    },
  };
}
