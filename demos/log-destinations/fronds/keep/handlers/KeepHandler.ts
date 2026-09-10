import type { Fact, LogLine } from '@fougere/core';
import Kept from '../services/Kept.js';

/**
 * A second destination, and the whole registration is this signature.
 *
 * It writes nowhere and announces nothing: a destination that logs is a ring, and the
 * emission refuses it by name — which is what `onLog`'s try/catch used to swallow.
 */
export default class KeepHandler {
  constructor(private kept: Kept) {}

  /** Keep one line. */
  async record(line: Fact<LogLine>): Promise<void> {
    this.kept.lines.push(`${line.at.toISOString()} ${line.level} ${line.message}`);
  }

  /** What has been kept so far. */
  async list(): Promise<string[]> {
    return [...this.kept.lines];
  }
}
