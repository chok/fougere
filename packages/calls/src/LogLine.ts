import { type LogRecord } from '@fougere/core';

/** One line this process wrote. `args` is the developer's own choice of what to record. */
export interface LogLine {
  seq: number;
  level: LogRecord['level'];
  name: string;
  message: string;
  /** Rendered here, not held: a live object would let the panel show what it later became. */
  args: string[];
  at: number;
}
