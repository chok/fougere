import type { Fact, LogLine } from '@fougere/core';
import type { LogSink } from '@fougere/core';

/**
 * Every line this process logged, on its way to a collector.
 *
 * A handler and not an `onLog` sink: accepting the fact IS the subscription. The exporter
 * comes from the container — `up` puts it there, and this resolves at the first call.
 *
 * In `src/` and not under `fronds/`: that directory is what a SCAN reads, and this frond
 * is stated, because a published package is read by no scanner.
 */
export default class ExportHandler {
  constructor(private exporting: { take: LogSink }) {}

  /** Send one line on. */
  async record(line: Fact<LogLine>): Promise<void> {
    this.exporting.take({ ...line, args: line.args ?? [], at: line.at.getTime() });
  }
}
