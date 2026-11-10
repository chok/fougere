import type { Fact, LogLine } from '@fougere/core';
import type { LogSink } from '@fougere/core';

/** Every line this process logged, on its way to a collector. */
export default class ExportHandler {
  constructor(private exporting: { take: LogSink }) {}

  /** Send one line on. */
  async record(line: Fact<LogLine>): Promise<void> {
    this.exporting.take({ ...line, args: line.args ?? [], at: line.at.getTime() });
  }
}
