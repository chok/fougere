import { Ring } from './Ring.js';
import { type LogRecord } from '@fougere/core';
import type { LogLine } from './LogLine.js';

/** What this process logged. */
export class LogRing extends Ring<LogLine> {
  record(line: LogRecord): void {
    this.keep((seq) => ({
      seq,
      level: line.level,
      name: line.name,
      message: line.message,
      args: line.args.map(render),
      at: line.at,
    }));
  }
}

/** An argument as one line. A live object would change under the reader; a string cannot. */
function render(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
