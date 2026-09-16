import { Logger, type AppNext, type OperationContext } from '@fougere/core';

/**
 * A line per write, and nothing for a read.
 *
 * It names no handler and no entity: it runs around every address this frond answers to,
 * including one whose handler carries no entity. `Logger` comes from the frond's own scope,
 * so the line says `blog:` without anyone writing it down.
 */
export default class Wrote {
  constructor(private log: Logger) {}

  async around(context: OperationContext, next: AppNext): Promise<unknown> {
    const answer = await next();
    if (context.operation !== 'list' && context.operation !== 'find') {
      this.log.info(`${context.entity}.${context.operation}`);
    }

    return answer;
  }
}
