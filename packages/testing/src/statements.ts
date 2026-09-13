import type { QueryEvent } from '@fougere/adapter-sql';

/**
 * Every statement a call ran, in order.
 *
 * `testApp` boots on real SQLite, so this is what the handler actually asked the database —
 * one per row is the shape of an N+1, and it is a number a test can refuse. A computed field
 * that reads is the case: the façade hands the presenter the whole PAGE, so one query is
 * possible, and nothing refuses `Promise.all(rows.map(…))` inside the field body.
 *
 * It REFUSES when `@fougere/adapter-sql` is absent, where the tracer degrades quietly: zero
 * is what a passing assertion looks like, so an app observing nothing would turn this into a
 * test that cannot fail.
 *
 * What it counts is the PROCESS, not the call — everything running while the block runs.
 */
export async function statementsOf(run: () => Promise<unknown>): Promise<QueryEvent[]> {
  const { onQuery } = await sql();
  const ran: QueryEvent[] = [];
  const stop = onQuery((event) => ran.push(event));

  try {
    await run();
  } finally {
    stop();
  }

  return ran;
}

/** Optional, and dynamic for the reason `@fougere/calls` states: this package depends on none. */
async function sql(): Promise<typeof import('@fougere/adapter-sql')> {
  try {
    return await import('@fougere/adapter-sql');
  } catch {
    throw new Error(
      '[statementsOf] counting statements needs @fougere/adapter-sql — install it, '
      + 'or the count is zero whatever the handler ran.',
    );
  }
}
