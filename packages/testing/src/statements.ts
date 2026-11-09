import type { QueryEvent } from '@fougere/adapter-sql';

/** Every statement the process ran while `run` ran; refuses when `@fougere/adapter-sql` is absent. */
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

async function sql(): Promise<typeof import('@fougere/adapter-sql')> {
  try {
    return await import('@fougere/adapter-sql');
  } catch {
    throw new Error(
      '[statementsOf] needs @fougere/adapter-sql. Install it.',
    );
  }
}
