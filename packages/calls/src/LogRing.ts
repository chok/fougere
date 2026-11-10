import { Ring } from './Ring.js';
import { argumentText, type LogRecord } from '@fougere/core';
import type { LogLine } from './LogLine.js';

/** What this process logged. */
export class LogRing extends Ring<LogLine> {
  record(line: LogRecord): void {
    this.keep((seq) => ({
      seq,
      level: line.level,
      name: line.name,
      message: line.message,
      args: line.args.map(argumentText),
      at: line.at,
    }));
  }
}
