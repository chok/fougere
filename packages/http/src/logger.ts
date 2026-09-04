/**
 * HTTP request logger middleware.
 */
import type { Middleware } from './router.js';

interface LoggerLike {
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
}

const STATUS_COLORS: Record<string, string> = {
  '2': '\x1b[32m', // green
  '3': '\x1b[36m', // cyan
  '4': '\x1b[33m', // yellow
  '5': '\x1b[31m', // red
};

/** HTTP request logger — logs method, path, status, and duration. */
export function httpLogger(logger: LoggerLike): Middleware {
  return async (ctx, next) => {
    const start = performance.now();
    const result = await next();
    const ms = (performance.now() - start).toFixed(1);

    const method = ctx.method.padEnd(7);
    const status = result.status;
    const log = status >= 400 ? 'warn' : 'info';

    logger[log](`${method} ${ctx.path} ${status} ${ms}ms`);

    return result;
  };
}
