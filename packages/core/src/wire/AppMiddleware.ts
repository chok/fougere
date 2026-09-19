import type { OperationContext } from './OperationContext.js';
import type { AppNext } from './AppNext.js';

/**
 * A middleware answers what the chain answered — the same TYPE, whatever it does with the value.
 *
 * `T` is the whole rule and nothing enforces it at runtime: a middleware is handed a type it
 * cannot name, so the only value of that type it can produce is the one `next()` gave it. It may
 * observe it, log it, replace it with another of the same shape, or refuse by throwing; it may
 * not wrap it in `{ data, meta }` nor invent one, because a caller reads the handler's signature
 * and nothing tells that signature a middleware stood in the way.
 */
export type AppMiddleware = <T>(ctx: OperationContext, next: AppNext<T>) => Promise<T>;

// ── Runner ──────────────────────────────────────

/**
 * Execute a middleware chain (onion model) then the handler.
 */
export function runMiddlewares(
  middlewares: AppMiddleware[],
  ctx: OperationContext,
  handler: AppNext,
): Promise<unknown> {
  let index = 0;
  const next = (): Promise<unknown> => {
    if (index < middlewares.length) {
      return middlewares[index++](ctx, next);
    }

    return handler();
  };

  return next();
}
