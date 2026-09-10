/**
 * Logger middleware — logs every operation with timing.
 */
import type { AppMiddleware } from './middleware.js';
import type { Logger } from '../builtin/logger.js';
import { CARRIES_LINE } from '../builtin/LogLine.js';

/** Create a logger middleware that logs operation entry, exit, and errors. */
export function loggerMiddleware(logger: Logger): AppMiddleware {
  return async (ctx, next) => {
    // An op that CARRIES a line writes none: it is dispatched, so logging it announces a
    // line inside the announcement of one — `Emission cycle: logLine → logLine`, which is
    // the emission catching what `onLog`'s try/catch used to swallow.
    if (CARRIES_LINE.has(ctx.entity)) return next();

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
