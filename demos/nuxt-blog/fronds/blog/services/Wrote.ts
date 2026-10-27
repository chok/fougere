import { Logger, type Call, type Dispatcher } from '@fougere/core';

/**
 * A line per write, and nothing for a read.
 *
 * It names no handler and no entity: it stands in front of every call this frond answers, including
 * one whose handler carries no entity. `Logger` comes from the frond's own scope, so the line says
 * `blog:` without anyone writing it down.
 */
export default class Wrote implements Partial<Dispatcher> {
  constructor(private inner: Dispatcher, private log: Logger) {}

  async dispatch(call: Call): Promise<unknown> {
    const answer = await this.inner.dispatch(call);
    const { address, operation } = call.address;
    if (operation !== 'list' && operation !== 'find') this.log.info(`${address}.${operation}`);

    return answer;
  }
}
