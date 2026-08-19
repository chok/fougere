import type { Logger } from '@fougere/core';

/**
 * The handler is built once, at its first call, and keeps the Logger it was handed —
 * `HandlerFacade` caches the instance for the life of the process. That is exactly why
 * the level must not live inside the object.
 */
export default class HealthHandler {
  constructor(private logger: Logger) {}

  /** Say something at every level, and report which logger took it. */
  async check(): Promise<{ logger: string }> {
    this.logger.debug('a debug line');
    this.logger.info('an info line');
    return { logger: this.logger.constructor.name };
  }
}
