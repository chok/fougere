import type { Fact } from '@fougere/core';
import type LogLine from '../../../../../fronds/log/entities/LogLine.js';

/** A second destination. It is a handler, and that is the whole registration. */
export default class AuditHandler {
  async record(line: Fact<LogLine>): Promise<void> {
    ((globalThis as Record<string, unknown>).__audited as { message: string; at: Date }[])
      .push({ message: line.message, at: line.at });
  }
}
