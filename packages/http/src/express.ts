/** Express adapter — bridges an Express app to the HttpRouter interface. */
import { type Handler } from './router/Handler.js';
import { type HttpMethod } from './router/HttpMethod.js';
import { chain, type HttpRouter } from './router/HttpRouter.js';
import { MAX_BODY_BYTES } from './router/BodyLimit.js';
import { HttpError } from './router/HttpError.js';
import { type Middleware } from './router/Middleware.js';
import { type RequestContext } from './router/RequestContext.js';
import { type ResponseResult } from './router/ResponseResult.js';

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


/** Drain the Node stream. Only reached when no body parser ran before us. */
export function readRawBody(req: any, maxBodyBytes = MAX_BODY_BYTES): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let exceeded = false;
    req.on('data', (chunk: Buffer) => {
      if (exceeded) return;
      size += chunk.length;
      if (size > maxBodyBytes) {
        exceeded = true;
        reject(HttpError.tooLarge(maxBodyBytes));

        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on('end', () => { if (!exceeded) resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', reject);
  });
}

/** Whether a request carries a body at all: a length above zero, or one sent in chunks. */
function sendsBody(headers: Record<string, unknown>): boolean {
  return Number(headers['content-length']) > 0 || headers['transfer-encoding'] !== undefined;
}

/** The JSON body of an Express request, whoever parsed it. */
export function readExpressBody(req: any, maxBodyBytes = MAX_BODY_BYTES): Promise<unknown> {
  if (req.__fougereBody) return req.__fougereBody;

  const verb = String(req.method ?? 'GET').toUpperCase();
  req.__fougereBody = (async () => {
    if (verb === 'GET' || verb === 'HEAD') return undefined;
    // `null` is parsed JSON, not evidence that no parser ran. Falling through here
    // turned an explicit domain value into `{}` (or tried to drain an already consumed
    // stream), while every other facade kept it.
    if (req.body !== undefined) return req.body;
    const contentType = String(req.headers?.['content-type'] ?? '');
    if (!contentType.toLowerCase().includes('json')) {
      if (sendsBody(req.headers ?? {})) throw HttpError.unsupportedMediaType(contentType);

      return undefined;
    }
    const raw = await readRawBody(req, maxBodyBytes);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw);
    } catch (cause) {
      throw HttpError.malformedJson(cause);
    }
  })();

  return req.__fougereBody;
}

function buildContext(req: any): RequestContext {
  // Kept as a plain string: a real request may be HEAD or OPTIONS, which the
  // interface's `HttpMethod` does not name. Casting here would have made the
  // "does this verb carry a body" question unaskable — it is asked below.
  const verb: string = req.method.toUpperCase();
  let request: Request | undefined;

  // One reader for both consumers — see `readExpressBody`.
  const body = () => readExpressBody(req);

  return {
    // The Request carries no body: Express may have consumed the stream already,
    // and a Request built around a drained one lies. `body()` is the honest reader,
    // and it is what every consumer in this repo calls.
    get request(): Request {
      if (!request) {
        const host = req.headers?.host ?? 'localhost';
        const url = `${req.protocol ?? 'http'}://${host}${req.originalUrl ?? req.url}`;
        request = new Request(url, {
          method: verb,
          headers: new Headers(
            Object.entries(req.headers ?? {})
              .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
          ),
        });
      }

      return request;
    },
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

/** Create an HttpRouter backed by an Express app. */
export function createExpressRouter(app: ExpressLike): HttpRouter {
  const globalMiddlewares: Middleware[] = [];
  const scopedMiddlewares: { path: string; mw: Middleware }[] = [];

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
          sendResponse(res, await chain(globalMiddlewares, scopedMiddlewares, buildContext(req), handler));
        } catch (err) {
          // This adapter reads the body, so it answers what it refuses to read — the same
          // 400, 413 and 415 as Hono, the other one that reads. Fastify's own parser
          // answers before we ever see the request.
          if (err instanceof HttpError) {
            sendResponse(res, err.result());

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
