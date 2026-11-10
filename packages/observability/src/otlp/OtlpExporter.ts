import { Beat } from '../Beat.js';
import { Endpoint } from '../Endpoint.js';
import type { FinishedSpan, SpanSink } from '../index.js';
import { metricsPayload } from '../metrics/Metrics.js';
import type { OtlpOptions } from './OtlpOptions.js';

export interface OtlpExporter {
  /** Hand to `onSpan`. */
  sink: SpanSink;
  /** Send what is buffered now — a process about to exit has to call this. */
  flush(): Promise<void>;
  /** Stop the timer and send what is left. */
  stop(): Promise<void>;
}

const OK = 1;

const ERROR = 2;

const INTERNAL = 1;

const SERVER = 2;

const CLIENT = 3;

export function otlp(options: OtlpOptions): OtlpExporter {
  const url = options.url ?? 'http://localhost:4318/v1/traces';
  const traces = Endpoint.at(url, options.onError);
  const metrics = Endpoint.at(
    options.metricsUrl ?? url.replace(/\/v1\/traces$/, '/v1/metrics'),
    options.onError,
  );
  let buffer: FinishedSpan[] = [];

  async function flush(): Promise<void> {
    const batch = buffer;
    buffer = [];
    await Promise.all([
      batch.length > 0 ? traces.post(payload(options.service, batch)) : Promise.resolve(),
      options.metrics ? metrics.post(metricsPayload(options.service, options.metrics.snapshot())) : Promise.resolve(),
    ]);
  }

  const beat = Beat.every(options.flushMs, flush);

  return {
    sink: (span) => { buffer.push(span); },
    flush,
    stop: () => beat.stop(),
  };
}

function payload(service: string, spans: FinishedSpan[]) {
  return {
    resourceSpans: [
      {
        resource: { attributes: [{ key: 'service.name', value: { stringValue: service } }] },
        scopeSpans: [
          {
            scope: { name: '@fougere/observability' },
            spans: spans.map((span) => ({
              traceId: span.traceId,
              spanId: span.spanId,
              ...(span.parentId ? { parentSpanId: span.parentId } : {}),
              name: `${span.address}.${span.operation}`,
              kind: kindOf(span),
              attributes: attributesOf(span),
              startTimeUnixNano: nanos(span.startedAt),
              endTimeUnixNano: nanos(span.startedAt + span.ms),
              status: span.error ? { code: ERROR, message: span.error } : { code: OK },
            })),
          },
        ],
      },
    ],
  };
}

function kindOf(span: FinishedSpan): number {
  if (span.kind === 'statement' || span.crossing === 'sent') return CLIENT;

  return span.crossing === 'received' ? SERVER : INTERNAL;
}

function attributesOf(span: FinishedSpan) {
  const values: [string, string | number | undefined][] = [
    ['rpc.system', 'fougere'],
    ['rpc.service', span.address],
    ['rpc.method', span.operation],
    ['fougere.frond', span.frond],
    ['fougere.caller_frond', span.callerFrond],
    ['fougere.statements', span.kind === 'operation' ? span.statements : undefined],
    ['fougere.error', span.error],
  ];

  return values
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => ({ key, value: typeof value === 'number' ? { intValue: String(value) } : { stringValue: value } }));
}

function nanos(ms: number): string {
  return `${Math.round(ms * 1e6)}`;
}
