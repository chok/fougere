/**
 * Log export — the third signal, and the only one whose value is entirely in its links.
 *
 * A log shipped without a trace id is a log stored somewhere else. What makes it the third
 * pillar is landing on a trace and reading the lines that call produced, so every record
 * leaves with the span it was written inside — which this package knows and the logger
 * deliberately does not.
 *
 * The logger emits a structured record and nothing more (`onLog` in core). Attaching the
 * trace, naming the severity and speaking OTLP all happen here.
 */
import { currentSpan } from './index.js';
import type { LogRecord } from '@fougere/core';

/** OTLP severity numbers — the scale is 1–24, these are the canonical rungs. */
const SEVERITY: Record<string, { number: number; text: string }> = {
  debug: { number: 5, text: 'DEBUG' },
  info: { number: 9, text: 'INFO' },
  warn: { number: 13, text: 'WARN' },
  error: { number: 17, text: 'ERROR' },
};

/** A record, plus what it could only be told at the moment it was written. */
export interface CapturedLog extends LogRecord {
  traceId: string | undefined;
  spanId: string | undefined;
}

export interface LogExporter {
  /** Hand to `onLog`. */
  sink: (record: LogRecord) => void;
  /** Send what is buffered now. */
  flush(): Promise<void>;
  /** Stop the timer and send what is left. */
  stop(): Promise<void>;
}

export interface LogsOptions {
  /** Which service these lines belong to. */
  service: string;
  /** Collector endpoint. Default: the OTLP/HTTP convention on localhost. */
  url?: string;
  /** How often a batch leaves. Default: every second. */
  flushMs?: number;
  /** Told when a batch could not be sent. Default: silence. */
  onError?: (err: unknown) => void;
  /**
   * Drop anything below this level before it leaves the process. Absent means "whatever
   * the logger let through" — `setLogLevel` has already filtered, and a second threshold
   * here would be a second place where the level lives.
   */
  minimum?: 'debug' | 'info' | 'warn' | 'error';
}

export function logs(options: LogsOptions): LogExporter {
  const url = options.url ?? 'http://localhost:4318/v1/logs';
  const floor = options.minimum ? SEVERITY[options.minimum].number : 0;
  let buffer: CapturedLog[] = [];

  async function flush(): Promise<void> {
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload(options.service, batch)),
      });
      if (!response.ok) options.onError?.(new Error(`${url} answered HTTP ${response.status}`));
    } catch (err) {
      options.onError?.(err);
    }
  }

  const timer = setInterval(() => void flush(), options.flushMs ?? 1_000);
  timer.unref?.();

  return {
    // The span is read HERE, while the line is being written — not at flush time, when
    // the call it belongs to is long over and the context is somebody else's.
    sink: (record) => {
      if (SEVERITY[record.level].number < floor) return;
      const span = currentSpan();
      buffer.push({ ...record, traceId: span?.traceId, spanId: span?.spanId });
    },
    flush,
    stop: async () => { clearInterval(timer); await flush(); },
  };
}

/** One batch, as OTLP/JSON spells logs. */
function payload(service: string, records: CapturedLog[]) {
  const attr = (key: string, value: string) => ({ key, value: { stringValue: value } });

  return {
    resourceLogs: [
      {
        resource: { attributes: [attr('service.name', service)] },
        scopeLogs: [
          {
            scope: { name: '@fougere/observability' },
            logRecords: records.map((record) => {
              const severity = SEVERITY[record.level];
              return {
                timeUnixNano: `${record.at * 1e6}`,
                observedTimeUnixNano: `${record.at * 1e6}`,
                severityNumber: severity.number,
                severityText: severity.text,
                body: { stringValue: bodyOf(record) },
                attributes: [attr('logger.name', record.name)],
                // Absent when the line was written outside any call — a boot line, a
                // shutdown line. Absent is the honest answer, not a zeroed id.
                ...(record.traceId ? { traceId: record.traceId } : {}),
                ...(record.spanId ? { spanId: record.spanId } : {}),
              };
            }),
          },
        ],
      },
    ],
  };
}

/**
 * The message with its arguments folded in. A log call takes extras the way `console`
 * does, and a collector stores one body — so they are joined rather than dropped.
 */
function bodyOf(record: CapturedLog): string {
  if (record.args.length === 0) return record.message;
  return [record.message, ...record.args.map(readable)].join(' ');
}

function readable(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
