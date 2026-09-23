/** @fougere/observability — one span per operation, and the trace that survives a wire. */
import { traceContext } from '#trace-context';
import { CARRIES_LINE, type AppMiddleware } from '@fougere/core';
import { parseTraceparent, traceparentOf, randomHex, type SpanContext } from './traceparent.js';

/** A step while it runs. */
interface Running extends SpanContext {
  frond: string | undefined;
  /**
   * When this step began, on both clocks — carried so what runs UNDER it is dated in ITS
   * frame rather than on a clock of its own. `Date.now()` resolves to the millisecond and a
   * whole call can take a fraction of one, so a statement dating itself lands anywhere:
   * measured on SigNoz 2026-09-13, six queries drawn 17 µs to the LEFT of the call that made
   * them, then all six stacked on its first instant. Offset from the monotonic clock, they
   * fall where they ran.
   */
  startedAt: number;
  start: number;
}

/**
 * What a span is a span OF. An operation was dispatched and has an address; a statement ran
 * underneath one and has a table. A reader that counts operations has to say which it takes.
 */
export type SpanKind = 'operation' | 'statement';

/** Which end of a hop an operation span stands at — absent when the call stayed in this process. */
export type Crossing = 'sent' | 'received';

/** A step that has finished, and what it did. */
export interface FinishedSpan extends SpanContext {
  parentId: string | undefined;
  /**
   * The frond of the step this one is nested in, when it is a DIFFERENT one — an edge of the call
   * graph, `shop → catalog`.
   */
  callerFrond: string | undefined;
  /** Which frond owned the op — the deployment unit, so the first thing a reader groups by. */
  frond: string | undefined;
  kind: SpanKind;
  crossing: Crossing | undefined;
  entity: string;
  operation: string;
  /** When it started, in epoch milliseconds — an INSTANT, not an offset. */
  startedAt: number;
  ms: number;
  /**
   * `ms` minus what its OBSERVED children account for — the time this step spent itself. An op
   * that delegates everything reports a duration and almost no self, which is how a report
   * names the step that is actually slow instead of the one that waited for it.
   *
   * Never below zero, and that is not a guard: children running TOGETHER — the four queries
   * behind one `Promise.all` — add up to more than the step that holds them. What is
   * measured is the time nothing else accounts for, and there is no less of it than none.
   *
   * A child that finishes AFTER its parent is not deducted either: nothing was observed when
   * the subtraction ran. The figure stays true, it is only cleaner than it should be.
   */
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
  /**
   * A span of its OWN for every statement, and not only the time charged to the operation
   * above it. Off by default, and the default is not prudence: `selfMs` and `statements` are
   * counted either way, so what this adds is WHICH queries ran — a diagnosis, against a
   * volume that multiplies by however many rows the page held. A backend charges per span.
   *
   * The pair splits the way profiling splits from monitoring: the count DETECTS, and it runs
   * always; the detail EXPLAINS, and it is turned on over the operation the count named.
   */
  spanPerStatement?: boolean;
  /**
   * What share of the operations that stay in this process are traced, `0` to `1`.
   *
   * A rate is a BUDGET — how much a backend is worth per day — and no reading of the code
   * answers it, so it is the operator's to set. What the code does answer is which spans the
   * budget may not touch: an operation that crosses a process produces the one signal nothing
   * else carries, since the difference between the caller's span and the callee's IS the wire
   * cost, and neither process can measure it alone. So a rate below one thins what is already
   * described by its own histogram, and never what only a trace can show.
   *
   * Default `1`, which is what a process did before this existed. The gain is not the default:
   * it is that turning the rate down no longer drops the traces that matter most.
   */
  sample?: number;
  /** How far an operation's work goes, by `entity.op` — the boot reads it off the model. */
  hopsOf?: (entity: string, operation: string) => number;
}

/** The step running here and now. */

/** The step running right now, if any. */
export function currentSpan(): SpanContext | undefined {
  return traceContext.current<Running>();
}

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

/**
 * The tracer of ONE app, and it is HANDED who takes the spans it finishes.
 *
 * The list belongs to the app the middleware was installed on, never to the process: a
 * discarded app went on feeding the takers of the app that replaced it, so every metric
 * counted twice. A module-level array made that a leak you had to remember to undo; a list
 * held beside the app cannot outlive it. Read at every end, so a taker added later counts.
 *
 * Two facades and not one, because a statement is not dispatched: nothing calls a middleware
 * around a query. What both need is the same table — the time a step's children accounted
 * for — so the two sit in one closure rather than reaching for each other.
 *
 * Documented: [observability](https://fougere.dev/docs/infra/observability).
 */
export function tracing(takers: readonly SpanSink[], options: TracingOptions = {}): Tracing {
  /** What a step's children have accounted for, by the step they ran under. */
  const charged = new Map<string, { ms: number; statements: number }>();
  const rate = options.sample ?? 1;
  const hopsOf = options.hopsOf ?? (() => 0);

  /**
   * Whether a root span is kept. An operation that leaves the process always is — the budget is
   * for the ones a histogram already describes.
   */
  const keeps = (entity: string, operation: string) =>
    rate >= 1 || hopsOf(entity, operation) > 0 || Math.random() < rate;

  const middleware: AppMiddleware = (ctx, next) => {
    if (takers.length === 0) return next();
    // An op that CARRIES a line is not a call this process made: counting it puts the
    // delivery of a log line in the saturation figure, and spanning it puts a line about
    // the span back on the wire. Same rule as `loggerMiddleware`, one declaration.
    if (CARRIES_LINE.has(ctx.entity)) return next();

    // The wire first, the ambient context second: an arriving call names its parent on
    // the invocation, an outgoing one inherits from the call it is made inside.
    const inherited = parseTraceparent(ctx.invocation?.trace);
    const ambient = traceContext.current<Running>();
    const parent = inherited ?? ambient;
    // Both, and they are not the same measurement: the wall clock says WHEN so two
    // processes land on one timeline, the monotonic one says HOW LONG without being
    // moved by an NTP correction mid-call.
    const startedAt = Date.now();
    const start = performance.now();
    const span: Running = {
      traceId: parent?.traceId ?? randomHex(16),
      spanId: randomHex(8),
      // A trace is whole or it is nothing: a call under a sampled parent is sampled, whatever
      // this process would have decided on its own. Only a root is decided here.
      sampled: parent?.sampled ?? keeps(ctx.entity, ctx.operation),
      frond: ctx.frond,
      startedAt,
      start,
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

    active += 1;
    const finish = (error: string | undefined) => {
      active -= 1;
      const ms = performance.now() - start;
      // Read and dropped in one gesture: a step ends once, and what its children owed it
      // is of no use to anyone after that.
      const owed = charged.get(span.spanId);
      charged.delete(span.spanId);
      const done: FinishedSpan = {
        ...span,
        parentId: parent?.spanId,
        callerFrond,
        frond: ctx.frond,
        kind: 'operation',
        crossing: ctx.crosses ? 'sent' : ctx.invocation?.crossed ? 'received' : undefined,
        entity: ctx.entity,
        operation: ctx.operation,
        startedAt,
        ms,
        selfMs: Math.max(0, ms - (owed?.ms ?? 0)),
        statements: owed?.statements ?? 0,
        error,
      };
      // A taker that throws is a broken exporter, never a broken call.
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
      // A statement with no operation above it — a migration, a seed — belongs to no step,
      // and inventing a trace for it would put a root span in the viewer per row planted.
      const under = traceContext.current<Running>();
      if (!under) return;

      const owed = charged.get(under.spanId) ?? { ms: 0, statements: 0 };
      owed.ms += ran.ms;
      owed.statements += 1;
      charged.set(under.spanId, owed);

      // The op above now reports what it waited for and how many times, which is the whole
      // of what a dashboard reads. WHICH queries ran leaves only when someone asks.
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
        entity: ran.subject,
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

/**
 * The join this package exists to make: a statement runs SYNCHRONOUSLY inside the async
 * context `tracing()` opened around the operation, so the sink finds the step it belongs to
 * without the app ever holding its sources — which is what made the two ends of `onQuery`
 * unable to see each other.
 *
 * `@fougere/adapter-sql` is optional, and dynamic for the reason `@fougere/calls` states:
 * this package declares no dependency on it. An app on another storage observes no
 * statement and every operation still reports its own time.
 */
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
