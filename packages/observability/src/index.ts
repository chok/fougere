/**
 * @fougere/observability — one span per operation, and the trace that survives a wire.
 *
 * Named for the subject and not for today's reading of it: a span carries an op's
 * duration and its verdict, which is the matter of a metric as much as of a trace, and
 * an exporter for either hangs off the same `onSpan`.
 *
 * Optional in the strong sense: core holds no tracing code at all, only a `trace` field
 * on the invocation that it carries and never reads. Everything else is here, behind
 * `app.use(trace())`, and an app that does not install it pays nothing.
 *
 * It is an ordinary app middleware because an operation ALREADY has a lifecycle and it
 * is that one — a second hook system would be a second answer to a settled question.
 * The same middleware runs on both halves of a split: at the door a call arrives at, and
 * at the stand-in it leaves from. That is why the numbers line up across processes, and
 * why the difference between the two spans is what the wire cost.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { AppMiddleware } from '@fougere/core';
import { parseTraceparent, traceparentOf, randomHex, type SpanContext } from './traceparent.js';

export { traceparentOf, parseTraceparent } from './traceparent.js';
export type { SpanContext } from './traceparent.js';

/**
 * A step while it runs. `SpanContext` is the part that TRAVELS (W3C Trace Context, three
 * fields, nothing else); the frond is ours and stays in this process — which is enough,
 * because the only place an edge is knowable is the side that made the call.
 */
interface Running extends SpanContext {
  frond: string | undefined;
}

/** A step that has finished, and what it did. */
export interface FinishedSpan extends SpanContext {
  parentId: string | undefined;
  /**
   * The frond of the step this one is nested in, when it is a DIFFERENT one — an edge of
   * the call graph, `shop → catalog`.
   *
   * Only the caller can say it: a traceparent carries no frond, so a receiver knows it
   * has a parent and not whose. That is not a gap — the caller already published the edge.
   */
  callerFrond: string | undefined;
  /** Which frond owned the op — the deployment unit, so the first thing a reader groups by. */
  frond: string | undefined;
  entity: string;
  operation: string;
  /**
   * When it started, in epoch milliseconds — an INSTANT, not an offset.
   *
   * `performance.now()` measures the duration below and nothing else: it counts from
   * this process's own start, so two processes' numbers cannot be put on one timeline,
   * which is the only thing a trace is for.
   */
  startedAt: number;
  ms: number;
  /** The FougereError code when it refused, absent when it answered. */
  error: string | undefined;
}

export type SpanSink = (span: FinishedSpan) => void;

/**
 * The step running here and now.
 *
 * It exists for the call the wire cannot describe: a handler reaching a second frond
 * builds a fresh invocation, so the parent is not on that call — it is in the context
 * the first one is still running inside.
 */
const current = new AsyncLocalStorage<Running>();

/** The step running right now, if any. */
export function currentSpan(): SpanContext | undefined {
  return current.getStore();
}

/**
 * Who takes the spans this process finishes, consulted at every end like the log level.
 *
 * A list rather than one: a span is the source of a trace AND of a metric, so the two
 * exporters read the same value rather than the middleware producing it twice.
 * Returns the way to withdraw.
 */
const sinks: SpanSink[] = [];

/**
 * Calls running right now — the saturation signal, and the only one a FINISHED span
 * cannot carry. Counted at the same two moments the span is opened and closed.
 */
let active = 0;

export function activeCalls(): number {
  return active;
}

export function onSpan(next: SpanSink): () => void {
  sinks.push(next);
  return () => {
    const at = sinks.indexOf(next);
    if (at >= 0) sinks.splice(at, 1);
  };
}

/**
 * The middleware. `app.use(trace())` traces every operation; `app.use('post', trace())`
 * traces one entity's.
 *
 * Nothing is opened while no sink is set: observing is a decision, and the cost of one
 * nobody asked for is zero rather than small.
 */
export function trace(): AppMiddleware {
  return (ctx, next) => {
    if (sinks.length === 0) return next();

    // The wire first, the ambient context second: an arriving call names its parent on
    // the invocation, an outgoing one inherits from the call it is made inside.
    const inherited = parseTraceparent(ctx.invocation?.trace);
    const ambient = current.getStore();
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

    return current.run(span, async () => {
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
export { metrics, metricsPayload } from './metrics.js';
export type { Metrics, MetricsSnapshot } from './metrics.js';
export { logs } from './logs.js';
export type { LogsOptions, LogExporter, CapturedLog } from './logs.js';
