import type { OperationContext } from './OperationContext.js';
import type { AppNext } from './AppNext.js';

export type AppMiddleware = (ctx: OperationContext, next: AppNext) => Promise<unknown>;

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
