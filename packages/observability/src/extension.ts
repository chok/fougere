/** This package's own ascent and descent, in one value. */
import { frond, Logger, LogLine, type App, type Extension, type LogSink } from '@fougere/core';
import ExportHandler from './ExportHandler.js';
import { traceContext } from './traceContext.js';
import { registerFlush, statementsUnder, tracing, type SpanSink } from './index.js';
import { metrics, serveTopology } from './metrics/Metrics.js';
import { otlp } from './otlp/OtlpExporter.js';
import { logs } from './logs/LogExporter.js';

export interface ObservabilityOptions {
  /** What a dashboard groups this process by, and the name a log line carries. */
  service?: string;
  /** An OTLP collector's base URL — SigNoz, Jaeger, Tempo all read the same one. */
  otlp?: string;
  flushMs?: number;
  /** A collector that cannot be reached is the app's business, not its failure. */
  onError?: (error: unknown) => void;
  /** One more taker for this app's spans, released with the app. */
  onSpan?: SpanSink;
  /** A span of its own for every statement, beside the count every operation already carries. */
  spanPerStatement?: boolean;
  /** What share of the operations that stay in this process are traced, `0` to `1`. */
  sample?: number;
  /** Bucket bounds in seconds for the duration histograms. */
  bounds?: readonly number[];
}

function hopsIn(app: App): (address: string, operation: string) => number {
  const hops = new Map<string, number>();
  for (const frond of app.fronds) {
    for (const handler of frond.handlers) {
      for (const [name, op] of app.operationsFor(handler.address) ?? []) {
        hops.set(`${handler.address}.${name}`, op.reach.hops);
      }
    }
  }

  return (address, operation) => hops.get(`${address}.${operation}`) ?? 0;
}

/** Observe this process — one member of the ascent. */
export function observability(options: ObservabilityOptions = {}): Extension {
  const service = options.service ?? 'fougere';
  const undoing = new WeakMap<App, (() => void | Promise<void>)[]>();

  const exporting: { take: LogSink } = { take: () => {} };

  const takers = new WeakMap<App, SpanSink[]>();

  return {
    name: 'observability',

    fronds: [frond('observability', {
      handlers: [{
        ctor: ExportHandler,
        deps: ['LogExport'],
        operations: {
          record: {
            input: LogLine,
            binding: [{ name: 'line', optional: false, source: { kind: 'fact', factName: 'logLine' } }],
          },
        },
      }],
    })],

    async up(app: App) {
      app.container.registerValue('LogExport', exporting);
      const undo: (() => void | Promise<void>)[] = [];
      undoing.set(app, undo);
      const spans: SpanSink[] = options.onSpan ? [options.onSpan] : [];
      takers.set(app, spans);
      const tracer = tracing(spans, {
        spanPerStatement: options.spanPerStatement ?? false,
        ...(options.sample === undefined ? {} : { sample: options.sample }),
        hopsOf: hopsIn(app),
      });
      app.use(tracer.middleware);
      undo.push(await statementsUnder(tracer));

      if (!traceContext.ambient) {
        app.container.resolve<Logger>('Logger').child(service).warn(
          'This runtime has no async context, so calls inside this process start their own trace instead of joining '
          + "the caller's. Add \"nodejs_compat\" to compatibility_flags to fix it.",
        );
      }

      const measured = metrics(app, options.bounds);
      spans.push(measured.sink);
      serveTopology(app, measured);

      if (!options.otlp) return;
      const base = options.otlp.replace(/\/$/, '');
      const telemetry = otlp({
        service,
        url: `${base}/v1/traces`,
        metricsUrl: `${base}/v1/metrics`,
        metrics: measured,
        ...(options.flushMs === undefined ? {} : { flushMs: options.flushMs }),
        ...(options.onError ? { onError: options.onError } : {}),
      });
      const written = logs({
        service,
        url: `${base}/v1/logs`,
        ...(options.flushMs === undefined ? {} : { flushMs: options.flushMs }),
        ...(options.onError ? { onError: options.onError } : {}),
      });
      exporting.take = written.sink;
      spans.push(telemetry.sink);
      undo.push(
        registerFlush(() => telemetry.flush()), registerFlush(() => written.flush()),
        () => telemetry.stop(), () => written.stop(),
        () => { exporting.take = () => {}; },
      );
    },
    async down(app: App) {
      const undo = undoing.get(app);
      if (!undo) return;
      undoing.delete(app);
      takers.delete(app);
      for (const step of undo.reverse()) await step();
    },
  };
}
