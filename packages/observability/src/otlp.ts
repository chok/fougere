/** OTLP export — the spans this process finished, in the one shape every collector reads. */
import { Beat } from './Beat.js';
import { Endpoint } from './Endpoint.js';
import type { FinishedSpan, SpanSink } from './index.js';
import { metricsPayload, type Metrics } from './metrics.js';

export interface OtlpOptions {
  /** Which service these spans belong to — what a dashboard groups by. */
  service: string;
  /** Collector endpoint. Default: the OTLP/HTTP convention on localhost. */
  url?: string;
  /** How often a full batch leaves. Default: every second. */
  flushMs?: number;
  /** Told when a batch could not be sent. Default: silence — a trace must never break a call. */
  onError?: (err: unknown) => void;
  /** Publish these metrics on the same beat. */
  metrics?: Metrics;
  /** Where metrics go when it is not the same collector as traces. */
  metricsUrl?: string;
}

export interface OtlpExporter {
  /** Hand to `onSpan`. */
  sink: SpanSink;
  /** Send what is buffered now — a process about to exit has to call this. */
  flush(): Promise<void>;
  /** Stop the timer and send what is left. */
  stop(): Promise<void>;
}

/** OTLP status codes: 0 unset, 1 ok, 2 error. */
const OK = 1;
const ERROR = 2;

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
    // Metrics go on every beat even when no span finished: a gauge that stops being
    // published reads as "gone", not as "idle".
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

/** One batch, as OTLP/JSON spells it — trace and span ids stay hex, times are nanos. */
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
              name: `${span.entity}.${span.operation}`,
              kind: 1,
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

/** Epoch milliseconds → the int64 nanoseconds OTLP wants, as a string. */
function nanos(ms: number): string {
  return `${Math.round(ms * 1e6)}`;
}
