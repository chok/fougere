import type { LogLevel } from './LogLevel.js';

/** One line, ready for a terminal: the console arguments and the method that takes them. */
export interface Rendered {
  level: Exclude<LogLevel, 'silent'>;
  name: string;
  message: string;
  during?: string | null;
  /** Absent on most lines: a message usually carries its own detail. */
  args?: unknown[] | null;
  /** Epoch milliseconds from a logger, a `Date` from an entity that stamped it. */
  at: number | Date;
}
