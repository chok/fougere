import type { Fact, LogLine } from '@fougere/core';
import { ErrorRing } from './ErrorRing.js';
import { LogRing } from './LogRing.js';

/** Every line this process logged, kept for the panel. */
export default class KeepHandler {
  constructor(private lines: LogRing, private errors: ErrorRing) {}

  /** Keep one line, and group it as a refusal when that is what it says. */
  async record(line: Fact<LogLine>): Promise<void> {
    const record = { ...line, args: line.args ?? [], at: line.at.getTime() };
    this.lines.record(record);
    this.errors.fromLog(record);
  }
}
