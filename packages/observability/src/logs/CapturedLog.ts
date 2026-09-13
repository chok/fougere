import type { LogRecord } from '@fougere/core';

/** A record, plus what it could only be told at the moment it was written. */
export interface CapturedLog extends LogRecord {
  traceId: string | undefined;
  spanId: string | undefined;
}
