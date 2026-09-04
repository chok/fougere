/** @fougere/http — framework-agnostic HTTP router interface. */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestContext {
  /** The request as a Web Standard `Request`. */
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
/** What `next()` answers when the host framework — not us — owns the chain. */
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

/** The onion chain both adapters run: */
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
