import type { LogRecord } from './LogRecord.js';

/**
 * Where one boot's lines wait, and where they go once they can.
 *
 * PER BOOT and never per process: two apps in one process each have their own
 * destinations, and a slot shared between them sent the second app's lines to the first
 * app's facade — measured on `demos/observability`, where only the first of three printed.
 *
 * A boot writes most of what a process ever logs, and it writes it before any emission is
 * registered, so the lines that say what an app is made of are the ones a destination
 * would miss. Bounded: a boot that never finishes must not grow, and what is dropped is
 * the OLDEST since the lines explaining a refusal are the last.
 */
export class Carry {
  private held: LogRecord[] = [];
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
    this.held.push(record);
    if (this.held.length > Carry.MAX) this.held.shift();
  }

  /** Hand what is held over, and everything after it. */
  to(take: (line: LogRecord) => void): () => void {
    this.take = take;
    for (const line of this.held.splice(0)) take(line);

    return () => { this.take = undefined; };
  }

  /**
   * Forget what is still held — a boot that refused, or an app that declares no
   * destination. Nothing is printed: the console had every one of these lines when it was
   * written, and the hold exists only to hand them on later.
   */
  forget(): void {
    this.held.length = 0;
  }
}
