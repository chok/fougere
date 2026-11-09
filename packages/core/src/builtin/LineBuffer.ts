import type { LogRecord } from './LogRecord.js';

/** Where one boot's lines wait until a destination exists; bounded, dropping the oldest. */
export class LineBuffer {
  private lines: LogRecord[] = [];
  private take?: (line: LogRecord) => void;

  static readonly MAX = 500;

  /** Take it now, or keep it for whoever arrives. */
  push(record: LogRecord): void {
    if (this.take) {
      try {
        this.take(record);
      } catch { /* announcing never breaks logging, for the same reason a sink does not */ }

      return;
    }
    this.lines.push(record);
    if (this.lines.length > LineBuffer.MAX) this.lines.shift();
  }

  /** Hand what is held over, and everything after it. */
  to(take: (line: LogRecord) => void): () => void {
    this.take = take;
    for (const line of this.lines.splice(0)) take(line);

    return () => { this.take = undefined; };
  }

  /** Forgets what is still held, without printing it. */
  drop(): void {
    this.lines.length = 0;
  }
}
