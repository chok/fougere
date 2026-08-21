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
export type Middleware = (ctx: RequestContext, next: Next) => Promise<ResponseResult>;

export interface HttpRouter {
  /** Register a global middleware. */
  use(middleware: Middleware): void;
  /** Register a middleware scoped to a path prefix. */
  use(path: string, middleware: Middleware): void;
  /** Register a route handler. */
  on(method: HttpMethod, path: string, handler: Handler): void;
}
