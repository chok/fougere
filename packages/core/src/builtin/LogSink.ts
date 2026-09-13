import type { LogRecord } from './LogRecord.js';

/** Where a line goes once it is written — `@fougere/log` ships one, `observability` another. */
export type LogSink = (record: LogRecord) => void;
