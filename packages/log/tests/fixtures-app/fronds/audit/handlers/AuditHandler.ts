import type { Fact, LogLine } from '@fougere/core';

/** A second destination. It is a handler, and that is the whole registration. */
export default class AuditHandler {
  async record(line: Fact<LogLine>): Promise<void> {
    ((globalThis as Record<string, unknown>).__audited as { message: string; at: Date }[])
      .push({ message: line.message, at: line.at });
  }
}
