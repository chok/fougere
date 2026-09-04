/**
 * Logger middleware — logs every operation with timing.
 */
import type { AppMiddleware } from './middleware.js';
import type { Logger } from '../builtin/logger.js';

/** Create a logger middleware that logs operation entry, exit, and errors. */
export function loggerMiddleware(logger: Logger): AppMiddleware {
  return async (ctx, next) => {
    const start = performance.now();
    logger.info(`${ctx.entity}.${ctx.operation}`);
    try {
      const result = await next();
      const ms = (performance.now() - start).toFixed(1);
      logger.info(`${ctx.entity}.${ctx.operation} (${ms}ms)`);
      return result;
    } catch (err) {
      const ms = (performance.now() - start).toFixed(1);
      logger.error(`${ctx.entity}.${ctx.operation} (${ms}ms)`, err);
      throw err;
    }
  };
}
