/**
 * The whole observability wiring, stated once because it is the same in every process.
 *
 * Three signals, one collector, and nothing about them in the domain code: a Frond does not
 * know it is observed, the same way it does not know whether its neighbour is local.
 */
import { onLog, loggerMiddleware, Logger, type App } from '@fougere/core';
import { trace, onSpan, otlp, metrics, logs } from '@fougere/observability';

/** Where an OTLP collector listens by convention. SigNoz, Jaeger, Tempo — all the same. */
const COLLECTOR = process.env.OTLP_URL ?? 'http://localhost:4318';

export interface Observed {
  /** Send what is buffered and stop the timers. A process about to exit owes this. */
  stop(): Promise<void>;
}

/**
 * `service` is what a dashboard groups by, and it is the only thing that differs between
 * the three processes here.
 */
/**
 * Say it once for the whole process. An unreachable collector says the same thing every two
 * seconds, per signal, per Frond — which buries the app's own output. The first line carries
 * the remedy; the rest carry nothing.
 */
let complained = false;

function complain(err: unknown): void {
  if (complained) return;
  complained = true;
  console.warn(
    `no OTLP collector on ${COLLECTOR} (${(err as Error)?.message ?? err}) — `
    + 'run `pnpm signoz`, or set OTLP_URL. The app runs fine without one.',
  );
}

export function observe(app: App, service: string): Observed {
  // Order matters: `trace()` opens the span that every log line written inside the call
  // will carry. Installed the other way round, the lines would leave uncorrelated.
  app.use(trace());
  app.use(loggerMiddleware(new Logger(service)));

  const measured = metrics(app);
  const telemetry = otlp({
    service,
    url: `${COLLECTOR}/v1/traces`,
    metricsUrl: `${COLLECTOR}/v1/metrics`,
    metrics: measured,
    flushMs: 2_000,
    onError: complain,
  });
  const written = logs({
    service,
    url: `${COLLECTOR}/v1/logs`,
    flushMs: 2_000,
    onError: complain,
  });

  // Two readers of one span — a trace and a metric are two readings of the same fact.
  onSpan(telemetry.sink);
  onSpan(measured.sink);
  onLog(written.sink);

  return {
    stop: async () => {
      await telemetry.stop();
      await written.stop();
    },
  };
}
