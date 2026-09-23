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

/** OTLP status codes: 0 unset, 1 ok, 2 error. */
const OK = 1;

const ERROR = 2;

/** OTLP span kinds, of the six only these three are ours. */
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
              // A statement left this process for an engine, and a hop for another process: a
              // viewer draws an edge between a CLIENT and the SERVER under it. `selfMs` is NOT
              // sent — a collector derives it from the tree it already holds.
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

/**
 * What a reader groups and filters by, under OpenTelemetry's RPC names where it has them —
 * a span that carried none left every collector with a name and a duration.
 */
function attributesOf(span: FinishedSpan) {
  const values: [string, string | number | undefined][] = [
    ['rpc.system', 'fougere'],
    ['rpc.service', span.entity],
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

/** Epoch milliseconds → the int64 nanoseconds OTLP wants, as a string. */
function nanos(ms: number): string {
  return `${Math.round(ms * 1e6)}`;
}
