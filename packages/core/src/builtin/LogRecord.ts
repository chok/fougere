import type { LogLevel } from './LogLevel.js';

/** One line, before it was formatted for a terminal. */
export interface LogRecord {
  level: Exclude<LogLevel, 'silent'>;
  /** The logger's own name — 'boot:app', 'boot:app:catalog'. */
  name: string;
  message: string;
  args: unknown[];
  /** The operation it was written inside — 'blog:PostHandler.publish'. */
  during?: string | null;
  /** Epoch milliseconds. */
  at: number;
}

/** An argument of a log line, as text. */
export function argumentText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
