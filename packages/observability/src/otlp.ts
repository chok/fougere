/**
 * OTLP export — the spans this process finished, in the one shape every collector reads.
 *
 * OTLP has a JSON encoding over plain HTTP, so this needs no protobuf and no dependency:
 * a POST to `/v1/traces`, and Jaeger, Tempo, Datadog or Honeycomb ingest it as-is.
 *
 * It is a sink and nothing more — `onSpan(otlp({...}).sink)` is the whole wiring. What
 * a span IS was decided by the middleware; this file only renames its fields.
 */
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
  /**
   * Publish these metrics on the same beat.
   *
   * Their endpoint defaults to the traces one with its last segment swapped — the OTLP
   * convention when a single collector takes both. Name `metricsUrl` when they are two:
   * traces and metrics are stored by different engines, and a deployment is free to run
   * one of each rather than a collector in front.
   */
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
  const metricsUrl = options.metricsUrl ?? url.replace(/\/v1\/traces$/, '/v1/metrics');
  let buffer: FinishedSpan[] = [];

  async function post(to: string, body: unknown): Promise<void> {
    try {
      const response = await fetch(to, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) options.onError?.(new Error(`${to} answered HTTP ${response.status}`));
    } catch (err) {
      options.onError?.(err);
    }
  }

  async function flush(): Promise<void> {
    const batch = buffer;
    buffer = [];
    // Metrics go on every beat even when no span finished: a gauge that stops being
    // published reads as "gone", not as "idle".
    await Promise.all([
      batch.length > 0 ? post(url, payload(options.service, batch)) : Promise.resolve(),
      options.metrics ? post(metricsUrl, metricsPayload(options.service, options.metrics.snapshot())) : Promise.resolve(),
    ]);
  }

  // `flushMs: 0` means "nobody is on a timer here, I will say when" — and on a Worker it
  // is not a preference, it is the only legal form: Cloudflare REFUSES a deployment whose
  // module scope sets a timeout ("Disallowed operation called within global scope"), and
  // an app built at module scope builds its exporter there. Measured 2026-08-23, the
  // deploy failed with error 10021. The isolate is frozen at the response anyway, so the
  // timer could never have fired; `ctx.waitUntil(flushTelemetry())` is what sends.
  //
  // `unref` so a buffered span never keeps a process alive: exporting is something the
  // process does on its way, never a reason for it to stay.
  const every = options.flushMs ?? 1_000;
  const timer = every > 0 ? setInterval(() => void flush(), every) : undefined;
  timer?.unref?.();

  return {
    sink: (span) => { buffer.push(span); },
    flush,
    stop: async () => { if (timer) clearInterval(timer); await flush(); },
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
