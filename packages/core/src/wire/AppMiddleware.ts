import type { OperationContext } from './OperationContext.js';
import type { AppNext } from './AppNext.js';

/** A middleware answers what the chain answered: the same type, whatever it does with the value. */
export type AppMiddleware = <T>(ctx: OperationContext, next: AppNext<T>) => Promise<T>;


/** Runs a middleware chain, then the handler. */
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
