import type { LogLevel } from './LogLevel.js';

/**
 * One line, ready for a terminal — the console arguments and which method takes them.
 *
 * Here rather than inside the class because the boot is not the only writer: a destination
 * that prints (`@fougere/log`) hands its own record to the same formatting, so the two
 * outputs cannot drift.
 *
 * One console method per level: `debug` and `info` both went to `console.log`, so nothing
 * downstream — a terminal filter, a collector — could tell them apart.
 */
export interface Rendered {
  level: Exclude<LogLevel, 'silent'>;
  name: string;
  message: string;
  /** Absent on most lines: a message usually carries its own detail. */
  args?: unknown[] | null;
  /** Epoch milliseconds from a logger, a `Date` from an entity that stamped it. */
  at: number | Date;
}
