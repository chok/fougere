/**
 * @fougere/http — framework-agnostic HTTP router interface.
 *
 * Adapters (Hono, Fastify, etc.) implement HttpRouter.
 * Consumers (schema-rest, schema-graphql) program against it.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestContext {
  /**
   * The request as a Web Standard `Request`.
   *
   * Built on FIRST ACCESS. Every adapter used to build one eagerly, and no consumer
   * in this repo reads it — measured, zero call sites outside the adapters and their
   * tests, while the construction cost a fifth of the port's throughput on the engines
   * that have no `Request` of their own (express, fastify). Hono hands over the one it
   * already has, so nothing is deferred there.
   *
   * The fields beside it — `method`, `path`, `params`, `query`, `body` — are what the
   * projections read, and they are not derived from this one.
   */
  readonly request: Request;
  method: HttpMethod;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body: () => Promise<unknown>;
  /** Extensible bag — middlewares deposit data here (auth, session, etc.). */
  state: Record<string, unknown>;
}

export interface ResponseResult {
  status: number;
  data: unknown;
  headers?: Record<string, string | string[]>;
  /** Send data as raw body (not JSON-serialized). Use for HTML, XML, CSV, plain text, etc. */
  raw?: boolean;
}

/** Raised by an adapter when a request claims JSON but cannot be parsed. */
export class MalformedJsonError extends Error {
  constructor(options?: ErrorOptions) {
    super('Malformed JSON body', options);
    this.name = 'MalformedJsonError';
  }
}

export type Handler = (ctx: RequestContext) => Promise<ResponseResult>;
export type Next = () => Promise<ResponseResult>;
/**
 * What `next()` answers when the host framework — not us — owns the chain.
 *
 * Express and Fastify build their own middleware chain here, so a middleware's return IS
 * the response and there is nothing to distinguish. Hono owns its chain, so its adapter has
 * to tell "the middleware answered" from "the middleware delegated", and it used
 * `data === null` for the second. `null` is a legal body — `{ status: 403, data: null }` is
 * the ordinary spelling of a deny — so a middleware that REFUSED with no body was read as
 * having delegated: it was silently bypassed on Hono and honoured on Fastify. One contract,
 * two verdicts, on a value inside the value space.
 *
 * A symbol cannot be produced by accident, and no middleware author ever writes it: only an
 * adapter that does not own its chain returns it from the `next` it hands out.
 */
export const PASSTHROUGH: unique symbol = Symbol('fougere.http.passthrough');

export type Middleware = (ctx: RequestContext, next: Next) => Promise<ResponseResult>;

export interface HttpRouter {
  /** Register a global middleware. */
  use(middleware: Middleware): void;
  /** Register a middleware scoped to a path prefix. */
  use(path: string, middleware: Middleware): void;
  /** Register a route handler. */
  on(method: HttpMethod, path: string, handler: Handler): void;
}

/**
 * The onion chain both adapters run: matching middlewares around the handler.
 *
 * Stated once because it was stated twice, identically, in `express.ts` and `fastify.ts` —
 * the same package, and the same place `PASSTHROUGH` already lives. A scoped middleware
 * matches by `startsWith`, which is what makes the two adapters agree on a mounted path.
 */
export function chain(
  global: Middleware[],
  scoped: { path: string; mw: Middleware }[],
  ctx: RequestContext,
  handler: Handler,
): Promise<ResponseResult> {
  const matching = [
    ...global,
    ...scoped.filter((s) => ctx.path.startsWith(s.path)).map((s) => s.mw),
  ];

  let index = 0;
  const next = (): Promise<ResponseResult> =>
    index < matching.length ? matching[index++](ctx, next) : handler(ctx);

  return next();
}
