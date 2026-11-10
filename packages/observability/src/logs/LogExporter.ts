import { Beat } from '../Beat.js';
import { Endpoint } from '../Endpoint.js';
import { currentSpan } from '../index.js';
import { argumentText, type LogRecord } from '@fougere/core';
import type { CapturedLog } from './CapturedLog.js';
import type { LogsOptions } from './LogsOptions.js';

const SEVERITY: Record<string, { number: number; text: string }> = {
  debug: { number: 5, text: 'DEBUG' },
  info: { number: 9, text: 'INFO' },
  warn: { number: 13, text: 'WARN' },
  error: { number: 17, text: 'ERROR' },
};

export interface LogExporter {
  /** Hand to `onLog`. */
  sink: (record: LogRecord) => void;
  /** Send what is buffered now. */
  flush(): Promise<void>;
  /** Stop the timer and send what is left. */
  stop(): Promise<void>;
}

export function logs(options: LogsOptions): LogExporter {
  const collector = Endpoint.at(options.url ?? 'http://localhost:4318/v1/logs', options.onError);
  const floor = options.minimum ? SEVERITY[options.minimum].number : 0;
  let buffer: CapturedLog[] = [];

  async function flush(): Promise<void> {
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    await collector.post(payload(options.service, batch));
  }

  const beat = Beat.every(options.flushMs, flush);

  return {
    sink: (record) => {
      if (SEVERITY[record.level].number < floor) return;
      const span = currentSpan();
      buffer.push({ ...record, traceId: span?.traceId, spanId: span?.spanId });
    },
    flush,
    stop: () => beat.stop(),
  };
}

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

function bodyOf(record: CapturedLog): string {
  if (record.args.length === 0) return record.message;

  return [record.message, ...record.args.map(argumentText)].join(' ');
}
