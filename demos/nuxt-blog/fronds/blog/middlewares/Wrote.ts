import { Logger, Middleware, type AppNext, type OperationContext } from '@fougere/core';

/**
 * A line per write, and nothing for a read.
 *
 * It names no handler and no entity: it runs around every address this frond answers to,
 * including one whose handler carries no entity. `Logger` comes from the frond's own scope,
 * so the line says `blog:` without anyone writing it down.
 */
export default class Wrote extends Middleware {
  constructor(private log: Logger) {
    super();
  }

  async around<T>(context: OperationContext, next: AppNext<T>): Promise<T> {
    const answer = await next();
    if (context.operation !== 'list' && context.operation !== 'find') {
      this.log.info(`${context.address}.${context.operation}`);
    }

    return answer;
  }
}
