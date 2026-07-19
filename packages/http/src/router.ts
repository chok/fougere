/**
 * @fougere/http — framework-agnostic HTTP router interface.
 *
 * Adapters (Hono, Fastify, etc.) implement HttpRouter.
 * Consumers (schema-rest, schema-graphql) program against it.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RequestContext {
  /** The original Web Standard Request — source of truth. */
  request: Request;
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
