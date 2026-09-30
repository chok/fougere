import { CARRIES_LINE, type AppMiddleware, type Logger } from '@fougere/core';

/**
 * Two lines a call — that it began, and what it cost — written under the frond that answers. A
 * call from another process names the one that signed it.
 *
 * An op that CARRIES a line writes none: it is dispatched, so logging it announces a line inside
 * the announcement of one — `Emission cycle: logLine → logLine`.
 */
export function callLines(logger: Logger): AppMiddleware {
  return async (context, next) => {
    if (CARRIES_LINE.has(context.address)) return next();

    const log = context.frond ? logger.child(context.frond) : logger;
    const call = `${context.handler ?? context.address}.${context.operation}`;
    const from = context.invocation?.caller ? ` ← ${context.invocation.caller}` : '';
    const start = performance.now();
    const cost = () => `(${(performance.now() - start).toFixed(1)}ms)`;

    log.info(`${call}${from}`);
    try {
      const result = await next();
      log.info(`${call} ${cost()}${from}`);

      return result;
    } catch (error) {
      log.error(`${call} ${cost()}${from}`, error);
      throw error;
    }
  };
}
