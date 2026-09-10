import type { Fact, LogLine } from '@fougere/core';
import { LogRing, ErrorRing } from './rings.js';

/**
 * Every line this process logged, kept for the panel.
 *
 * A handler and not an `onLog` sink: accepting the fact IS the subscription, so the two
 * rings are filled by the same door every other reader goes through — with a validator,
 * and with whatever middleware the app declared.
 *
 * The rings come from the container: the extension's `up` put them there, and this
 * resolves at the first call, which is after.
 *
 * In `src/` and not under `fronds/`: that directory is what a SCAN reads, and this frond
 * is stated (`frond('calls', …)`) because a published package is read by no scanner.
 */
export default class KeepHandler {
  constructor(private lines: LogRing, private errors: ErrorRing) {}

  /** Keep one line, and group it as a refusal when that is what it says. */
  async record(line: Fact<LogLine>): Promise<void> {
    const record = { ...line, args: line.args ?? [], at: line.at.getTime() };
    this.lines.record(record);
    this.errors.fromLog(record);
  }
}
