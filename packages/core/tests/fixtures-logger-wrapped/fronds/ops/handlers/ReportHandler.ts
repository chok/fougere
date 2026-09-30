import { Logger } from '@fougere/core';

export default class ReportHandler {
  constructor(private logger: Logger) {}

  /** Log a line carrying a secret. */
  async run(): Promise<{ logger: string }> {
    this.logger.info('report ran with token=abc123');

    return { logger: this.logger.constructor.name };
  }
}
