/** @fougere/observability — one span per operation, and the trace that survives a wire. */
import { traceContext } from './traceContext.js';
import { CARRIES_LINE, type AppMiddleware } from '@fougere/core';
import { parseTraceparent, traceparentOf, randomHex, type SpanContext } from './traceparent.js';

interface Running extends SpanContext {
  frond: string | undefined;
  /** When this step began, on both clocks, so what runs under it is dated in its frame. */
  startedAt: number;
  start: number;
}

/** What a span is a span of: an operation, or a statement under one. */
export type SpanKind = 'operation' | 'statement';

/** Which end of a hop an operation span stands at — absent when the call stayed in this process. */
export type Crossing = 'sent' | 'received';

/** A step that has finished, and what it did. */
export interface FinishedSpan extends SpanContext {
  parentId: string | undefined;
  /**
   * The frond of the enclosing step, when it is a different one.
   * Ex: `shop → catalog`.
   */
  callerFrond: string | undefined;
  /** Which frond owned the op — the deployment unit, so the first thing a reader groups by. */
  frond: string | undefined;
  kind: SpanKind;
  crossing: Crossing | undefined;
  address: string;
  operation: string;
  /** When it started, in epoch milliseconds — an INSTANT, not an offset. */
  startedAt: number;
  ms: number;
  /** `ms` minus what its observed children account for, never below zero. */
  selfMs: number;
  /** How many statements ran under this step — one per row is the shape of an N+1. */
  statements: number;
  /** The FougereError code when it refused, absent when it answered. */
  error: string | undefined;
}

export type SpanSink = (span: FinishedSpan) => void;

/** A statement as its producer describes it — never the values it was given. */
export interface Statement {
  /** What it read or wrote: the table, or the source when the statement names none. */
  subject: string;
  /** `select`, `insert`, `update`, `delete`. */
  verb: string;
  ms: number;
  failed: boolean;
}

/** What an app's tracer answers for. */
export interface Tracing {
  /** One span per operation — handed to `app.use`. */
  middleware: AppMiddleware;
  /** A statement that ran under the operation in flight: its time charged upward, and its own span when asked. */
  statement(ran: Statement): void;
}

export interface TracingOptions {
  /** A span of its own for every statement, beside the count every operation carries. */
  spanPerStatement?: boolean;
  /** What share of the operations that stay in this process are traced, `0` to `1`. */
  sample?: number;
  /** How far an operation's work goes, by `address.op` — the boot reads it off the model. */
  hopsOf?: (address: string, operation: string) => number;
}

/** The step running here and now. */

/** The step running right now, if any. */
export function currentSpan(): SpanContext | undefined {
  return traceContext.current<Running>();
}

let active = 0;

export function activeCalls(): number {
  return active;
}

const flushes: (() => Promise<void>)[] = [];

/** Send what is buffered, now. */
export async function flushTelemetry(): Promise<void> {
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

/**
 * The tracer of one app, handed who takes the spans it finishes.
 *
 * Documented: [observability](https://fougere.dev/docs/run/observe).
 */
export function tracing(takers: readonly SpanSink[], options: TracingOptions = {}): Tracing {
  const charged = new Map<string, { ms: number; statements: number }>();
  const rate = options.sample ?? 1;
  const hopsOf = options.hopsOf ?? (() => 0);

  const keeps = (address: string, operation: string) =>
    rate >= 1 || hopsOf(address, operation) > 0 || Math.random() < rate;

  const middleware: AppMiddleware = (ctx, next) => {
    if (takers.length === 0) return next();
    if (CARRIES_LINE.has(ctx.address)) return next();

    const inherited = parseTraceparent(ctx.invocation?.trace);
    const ambient = traceContext.current<Running>();
    const parent = inherited ?? ambient;
    const startedAt = Date.now();
    const start = performance.now();
    const span: Running = {
      traceId: parent?.traceId ?? randomHex(16),
      spanId: randomHex(8),
      sampled: parent?.sampled ?? keeps(ctx.address, ctx.operation),
      frond: ctx.frond,
      startedAt,
      start,
    };
    const callerFrond =
      !inherited && ambient?.frond && ambient.frond !== ctx.frond ? ambient.frond : undefined;

    if (ctx.invocation) ctx.invocation = { ...ctx.invocation, trace: traceparentOf(span) };

    active += 1;
    const finish = (error: string | undefined) => {
      active -= 1;
      const ms = performance.now() - start;
      const owed = charged.get(span.spanId);
      charged.delete(span.spanId);
      const done: FinishedSpan = {
        ...span,
        parentId: parent?.spanId,
        callerFrond,
        frond: ctx.frond,
        kind: 'operation',
        crossing: ctx.toAnotherProcess ? 'sent' : ctx.invocation?.fromAnotherProcess ? 'received' : undefined,
        address: ctx.address,
        operation: ctx.operation,
        startedAt,
        ms,
        selfMs: Math.max(0, ms - (owed?.ms ?? 0)),
        statements: owed?.statements ?? 0,
        error,
      };
      for (const take of takers) { try { take(done); } catch { /* observing never refuses */ } }
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

  return {
    middleware,

    statement(ran: Statement): void {
      if (takers.length === 0) return;
      const under = traceContext.current<Running>();
      if (!under) return;

      const owed = charged.get(under.spanId) ?? { ms: 0, statements: 0 };
      owed.ms += ran.ms;
      owed.statements += 1;
      charged.set(under.spanId, owed);

      if (!options.spanPerStatement) return;

      const done: FinishedSpan = {
        traceId: under.traceId,
        spanId: randomHex(8),
        sampled: under.sampled,
        parentId: under.spanId,
        callerFrond: undefined,
        frond: under.frond,
        kind: 'statement',
        crossing: undefined,
        address: ran.subject,
        operation: ran.verb,
        startedAt: under.startedAt + Math.max(0, performance.now() - under.start - ran.ms),
        ms: ran.ms,
        selfMs: ran.ms,
        statements: 0,
        error: ran.failed ? 'STATEMENT_FAILED' : undefined,
      };
      for (const take of takers) { try { take(done); } catch { /* observing never refuses */ } }
    },
  };
}

/** Charges each statement to the operation it ran under, read off the async context. */
export async function statementsUnder(tracer: Tracing): Promise<() => void> {
  try {
    const { onQuery } = await import('@fougere/adapter-sql');

    return onQuery((event) => tracer.statement({
      subject: event.subject,
      verb: event.verb,
      ms: event.ms,
      failed: event.failed,
    }));
  } catch {
    return () => {};
  }
}

function codeOf(err: unknown): string {
  const code = (err as { code?: unknown })?.code;

  return typeof code === 'string' ? code : ((err as Error)?.name ?? 'error');
}

export { otlp } from './otlp/OtlpExporter.js';
export { metrics } from './metrics/Metrics.js';
export type { Metrics } from './metrics/Metrics.js';
export type { TopologyReport } from '@fougere/core';
export type { FrondPlacement, Edge } from '@fougere/core';
export { logs } from './logs/LogExporter.js';
export { observability } from './extension.js';
