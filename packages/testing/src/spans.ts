import type { App } from '@fougere/core';
import type { FinishedSpan } from '@fougere/observability';

const installed = new WeakMap<App, FinishedSpan[][]>();

/**
 * The steps one call opened: the operation, then what ran under it.
 * Ex: `expect(op.selfMs).toBeLessThan(0.1 * op.ms)`.
 */
export async function spansOf(app: App, run: () => Promise<unknown>): Promise<FinishedSpan[]> {
  const collecting = await tracerOf(app);
  const spans: FinishedSpan[] = [];
  collecting.push(spans);

  try {
    await run();
  } finally {
    collecting.splice(collecting.indexOf(spans), 1);
  }

  return spans;
}

async function tracerOf(app: App): Promise<FinishedSpan[][]> {
  const held = installed.get(app);
  if (held) return held;

  const { statementsUnder, tracing } = await observability();
  const collecting: FinishedSpan[][] = [];
  installed.set(app, collecting);
  const tracer = tracing(
    [(span) => { for (const into of collecting) into.push(span); }],
    { spanPerStatement: true },
  );
  app.use(tracer.middleware);
  await statementsUnder(tracer);

  return collecting;
}

async function observability(): Promise<typeof import('@fougere/observability')> {
  try {
    return await import('@fougere/observability');
  } catch {
    throw new Error(
      '[spansOf] needs @fougere/observability. Install it.',
    );
  }
}
