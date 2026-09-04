/** @fougere/observability — one span per operation, and the trace that survives a wire. */
import { traceContext } from '#trace-context';
import type { AppMiddleware } from '@fougere/core';
import { parseTraceparent, traceparentOf, randomHex, type SpanContext } from './traceparent.js';

export { traceparentOf, parseTraceparent } from './traceparent.js';
export type { SpanContext } from './traceparent.js';

/** A step while it runs. */
interface Running extends SpanContext {
  frond: string | undefined;
}

/** A step that has finished, and what it did. */
export interface FinishedSpan extends SpanContext {
  parentId: string | undefined;
  /** The frond of the step this one is nested in, when it is a DIFFERENT one — an edge of the call gra… */
  callerFrond: string | undefined;
  /** Which frond owned the op — the deployment unit, so the first thing a reader groups by. */
  frond: string | undefined;
  entity: string;
  operation: string;
  /** When it started, in epoch milliseconds — an INSTANT, not an offset. */
  startedAt: number;
  ms: number;
  /** The FougereError code when it refused, absent when it answered. */
  error: string | undefined;
}

export type SpanSink = (span: FinishedSpan) => void;

/** The step running here and now. */

/** The step running right now, if any. */
export function currentSpan(): SpanContext | undefined {
  return traceContext.current<Running>();
}

/** Who takes the spans this process finishes, consulted at every end like the log level. */
const sinks: SpanSink[] = [];

/**
 * Calls running right now — the saturation signal, and the only one a FINISHED span
 * cannot carry. Counted at the same two moments the span is opened and closed.
 */
let active = 0;

export function activeCalls(): number {
  return active;
}

/** Every exporter this process installed, so something can make them send NOW. */
const flushes: (() => Promise<void>)[] = [];

/** Send what is buffered, now. */
export async function flushTelemetry(): Promise<void> {
  // Every one, and the refusals together — a flush that abandons the rest loses the
  // windows after it, which is the answer `app.deliver` gives for the same shape.
  const failed = await Promise.allSettled(flushes.map((send) => send()));
  const refused = failed.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (refused.length > 0) throw new AggregateError(refused.map((r) => r.reason), 'telemetry flush');
}

/** Declare an exporter's flush, and answer the way to withdraw it — like `onSpan`. */
export function registerFlush(send: () => Promise<void>): () => void {
  flushes.push(send);
  return () => {
    const at = flushes.indexOf(send);
    if (at >= 0) flushes.splice(at, 1);
  };
}

export function onSpan(next: SpanSink): () => void {
  sinks.push(next);
  return () => {
    const at = sinks.indexOf(next);
    if (at >= 0) sinks.splice(at, 1);
  };
}

/** The middleware. */
export function trace(): AppMiddleware {
  return (ctx, next) => {
    if (sinks.length === 0) return next();

    // The wire first, the ambient context second: an arriving call names its parent on
    // the invocation, an outgoing one inherits from the call it is made inside.
    const inherited = parseTraceparent(ctx.invocation?.trace);
    const ambient = traceContext.current<Running>();
    const parent = inherited ?? ambient;
    const span: Running = {
      traceId: parent?.traceId ?? randomHex(16),
      spanId: randomHex(8),
      sampled: parent?.sampled ?? true,
      frond: ctx.frond,
    };
    // An edge exists only when the parent is IN this process and belongs to another frond.
    // `inherited` won means the parent is across a wire, and it did not name its frond.
    const callerFrond =
      !inherited && ambient?.frond && ambient.frond !== ctx.frond ? ambient.frond : undefined;

    // What this call hands to whatever it reaches next. Whether that is a transport or
    // nothing at all is not this middleware's business — it writes the field, the
    // invocation travels, and every transport carries it because every transport
    // carries the invocation.
    if (ctx.invocation) ctx.invocation = { ...ctx.invocation, trace: traceparentOf(span) };

    // Both, and they are not the same measurement: the wall clock says WHEN so two
    // processes land on one timeline, the monotonic one says HOW LONG without being
    // moved by an NTP correction mid-call.
    const startedAt = Date.now();
    const start = performance.now();
    active += 1;
    const finish = (error: string | undefined) => {
      active -= 1;
      const done: FinishedSpan = {
        ...span,
        parentId: parent?.spanId,
        callerFrond,
        frond: ctx.frond,
        entity: ctx.entity,
        operation: ctx.operation,
        startedAt,
        ms: performance.now() - start,
        error,
      };
      // A sink that throws is a broken exporter, never a broken call.
      for (const take of sinks) { try { take(done); } catch { /* observing never refuses */ } }
    };

    return traceContext.within(span, async () => {
      try {
        const result = await next();
        finish(undefined);
        return result;
      } catch (err) {
        finish(codeOf(err));
        throw err;
      }
    });
  };
}

function codeOf(err: unknown): string {
  const code = (err as { code?: unknown })?.code;
  return typeof code === 'string' ? code : ((err as Error)?.name ?? 'error');
}

export { otlp } from './otlp.js';
export type { OtlpOptions, OtlpExporter } from './otlp.js';
export { metrics, metricsPayload, serveTopology } from './metrics.js';
export type { Metrics, MetricsSnapshot, TopologyReport, FrondPlacement, Edge } from './metrics.js';
export { logs } from './logs.js';
export type { LogsOptions, LogExporter, CapturedLog } from './logs.js';
export { observability } from './extension.js';
export type { ObservabilityOptions } from './extension.js';
