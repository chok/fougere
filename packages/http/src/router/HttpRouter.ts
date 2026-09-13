import type { HttpMethod } from './HttpMethod.js';
import type { Handler } from './Handler.js';
import type { Middleware } from './Middleware.js';
import type { RequestContext } from './RequestContext.js';
import type { ResponseResult } from './ResponseResult.js';

export interface HttpRouter {
  /** Register a global middleware. */
  use(middleware: Middleware): void;
  /** Register a middleware scoped to a path prefix. */
  use(path: string, middleware: Middleware): void;
  /** Register a route handler. */
  on(method: HttpMethod, path: string, handler: Handler): void;
}

/** The onion chain both adapters run. */
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
