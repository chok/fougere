import { Logger } from '@fougere/core';

export default class ReportHandler {
  constructor(private logger: Logger) {}

  /** Log a line and say which logger took it. */
  async run(): Promise<{ logger: string; seen: number }> {
    this.logger.info('report ran');
    return {
      logger: this.logger.constructor.name,
      seen: (this.logger as unknown as { seen?: string[] }).seen?.length ?? -1,
    };
  }
}
