import type { App } from '@fougere/core';
import type { FinishedSpan } from '@fougere/observability';

/** One tracer per app: `app.use` has no undo, so a second call would stack a middleware. */
const installed = new WeakMap<App, FinishedSpan[][]>();

/**
 * The steps one call opened — the operation, then whatever ran under it.
 *
 * The dual of [statementsOf]: that one counts what a call asked the database, this one holds
 * the shape of the call itself. What it is FOR is a test about structure rather than speed —
 * an op that delegates reports almost no self time, whatever the machine it runs on:
 *
 * ```ts
 * const [op] = await spansOf(app, () => door.list());
 * expect(op.selfMs).toBeLessThan(0.1 * op.ms);   // it delegates, it does not work
 * ```
 *
 * A threshold in milliseconds tests the machine. A ratio tests the code.
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
  // A test IS the diagnosis, so it asks for the detail a process running continuously does not.
  const tracer = tracing(
    [(span) => { for (const into of collecting) into.push(span); }],
    { spanPerStatement: true },
  );
  app.use(tracer.middleware);
  // Both halves, or `selfMs` would read as if the handler did the waiting itself. The
  // subscription lives as long as the test process: `app.use` has no undo either, and one
  // app per file is what a test file has.
  await statementsUnder(tracer);

  return collecting;
}

/** Optional, and dynamic for the reason `@fougere/calls` states: this package depends on none. */
async function observability(): Promise<typeof import('@fougere/observability')> {
  try {
    return await import('@fougere/observability');
  } catch {
    throw new Error(
      '[spansOf] reading what a call cost needs @fougere/observability — install it, '
      + 'or there is no span to read.',
    );
  }
}
