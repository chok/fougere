/**
 * Error handler middleware — normalizes errors into FougereError.
 */
import type { AppMiddleware } from '../middleware.js';
import { FougereError, ErrorCode } from '../errors.js';

/**
 * Create an error handler middleware that wraps thrown errors into FougereError.
 *
 * Errors that are already FougereError pass through unchanged.
 *
 * ```ts
 * app.use(errorMiddleware())
 * ```
 */
export function errorMiddleware(): AppMiddleware {
  return async (ctx, next) => {
    try {
      return await next();
    } catch (err: any) {
      if (err instanceof FougereError) throw err;
      throw new FougereError({
        code: ErrorCode.INTERNAL_ERROR,
        message: err.message ?? 'Internal error',
        entity: ctx.entity,
        operation: ctx.operation,
        cause: err,
      });
    }
  };
}
