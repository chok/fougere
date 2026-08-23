/**
 * This package's own ascent and descent, in one value.
 *
 * Four gestures in a fixed order — the middleware, the accumulator, the sinks, the wire op
 * — is a boot sequence, and a host had to know it: `demos/observability` wrote it out and
 * hand-rolled its own `stop()` beside it, which is a `down` under another name. Declared as
 * an extension, the order is stated once here and the release is not the host's to remember.
 *
 * It is not a frond and cannot become one: a frond may move behind `remotes:`, and this
 * reads the process it runs in — moved, it would report the observer instead of the observed.
 */
import { loggerMiddleware, Logger, onLog, type App, type Extension } from '@fougere/core';
import { traceContext } from '#trace-context';
import { registerFlush } from './index.js';
import { trace, onSpan } from './index.js';
import { metrics, serveTopology } from './metrics.js';
import { otlp } from './otlp.js';
import { logs } from './logs.js';

export interface ObservabilityOptions {
  /** What a dashboard groups this process by, and the name a log line carries. */
  service?: string;
  /**
   * An OTLP collector's base URL — SigNoz, Jaeger, Tempo all read the same one.
   *
   * Absent, nothing leaves the process and `rpc.topology` still answers: a panel asking
   * the app what shape it is in needs no collector.
   */
  otlp?: string;
  flushMs?: number;
  /** A collector that cannot be reached is the app's business, not its failure. */
  onError?: (error: unknown) => void;
}

/**
 * Observe this process — one member of the ascent.
 *
 * `up` wires in the order that matters and `down` withdraws in reverse, which is the whole
 * reason the two halves are one value: `onSpan` and `onLog` already RETURN their withdrawal
 * and nothing was calling it, so a discarded app kept feeding the sinks of the app that
 * replaced it. That is invisible until the ring turns, and then it doubles every metric.
 */
export function observability(options: ObservabilityOptions = {}): Extension {
  const service = options.service ?? 'fougere';
  /**
   * Per APP, not per extension. A host declares its extensions once (`configureFougere`),
   * so the same instance goes up on the new app before the old one is released: one shared
   * list meant the old app's `down` withdrew — and erased — the new app's sinks too, after
   * which every counter stayed frozen and nothing said so.
   */
  const undoing = new WeakMap<App, Array<() => void | Promise<void>>>();

  return {
    name: 'observability',
    up(app: App) {
      const undo: Array<() => void | Promise<void>> = [];
      undoing.set(app, undo);
      // Order matters: `trace()` opens the span that every log line written inside the
      // call will carry. Installed the other way round, the lines leave uncorrelated.
      app.use(trace());
      app.use(loggerMiddleware(new Logger(service)));

      // Said once, here, because the alternative is finding it in a trace viewer three
      // weeks later: without an ambient context a call that crossed NO wire cannot name
      // its parent, so it starts its own trace. What still works is stated too — a
      // warning that only names the loss reads as "tracing is broken", and it is not.
      if (!traceContext.ambient) {
        new Logger(service).warn(
          'no async context: a call that crosses no wire starts its own trace '
          + '(an emission subscriber, a handler reaching another frond in this process). '
          + 'An arriving call and a call to a frond behind `remotes:` are unaffected — both carry '
          + 'traceparent on the invocation. Add "nodejs_als" to compatibility_flags to restore the rest.',
        );
      }

      const measured = metrics(app);
      undo.push(onSpan(measured.sink));
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
      // The timer is not the only way out: an isolate is frozen when it answers, so a
      // host with no time between requests calls `flushTelemetry()` inside `ctx.waitUntil`.
      undo.push(
        onSpan(telemetry.sink), onLog(written.sink),
        registerFlush(() => telemetry.flush()), registerFlush(() => written.flush()),
        () => telemetry.stop(), () => written.stop(),
      );
    },
    async down(app: App) {
      // Reverse, and the exporters' `stop()` is in here: it flushes what is buffered, so a
      // released app publishes what it measured instead of dropping its last window.
      const undo = undoing.get(app);
      if (!undo) return;
      undoing.delete(app);
      for (const step of undo.reverse()) await step();
    },
  };
}
