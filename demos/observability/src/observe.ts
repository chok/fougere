/**
 * The whole observability wiring, which is now one line — and that is the point.
 *
 * It used to be four gestures in a fixed order plus a hand-rolled `stop()`: the order was
 * this file's to know, and the release was this file's to remember. `observability()` is
 * the same pair declared once, in the package that owns it, so a Frond still knows nothing
 * about being observed and a host knows nothing about how.
 */
import { observability } from '@fougere/observability';
import type { Extension } from '@fougere/core';

/** Where an OTLP collector listens by convention. SigNoz, Jaeger, Tempo — all the same. */
const COLLECTOR = process.env.OTLP_URL ?? 'http://localhost:4318';

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

/**
 * `service` is what a dashboard groups by, and it is the only thing that differs between
 * the three processes here.
 *
 * Handed to `createApp({ extensions })`: the release comes with it, so the process no
 * longer owes a `stop()` call it could forget.
 */
export function observed(service: string): Extension {
  return observability({ service, otlp: COLLECTOR, flushMs: 2_000, onError: complain });
}
