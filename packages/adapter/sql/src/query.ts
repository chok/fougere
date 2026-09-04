import type { LogEvent } from 'kysely';

/** One statement this process ran, and what it cost. */
export interface QueryEvent {
  /** Which storage ran it — a process may open several (`sources:`). */
  storage: string;
  sql: string;
  /** How MANY parameters, never their values. */
  parameters: number;
  /** Rounded to three decimals: a sub-microsecond statement reports 17 digits otherwise. */
  ms: number;
  failed: boolean;
  at: number;
}

export type QuerySink = (event: QueryEvent) => void;

const sinks: QuerySink[] = [];

/** Be told about every statement this process runs, and get the unsubscription back. */
export function onQuery(sink: QuerySink): () => void {
  sinks.push(sink);

  return () => {
    const at = sinks.indexOf(sink);
    if (at !== -1) sinks.splice(at, 1);
  };
}

/** The `log` every Kysely is built with. Named by storage, since a sink sees them all. */
export function logQueries(storage: string): (event: LogEvent) => void {
  return (event) => {
    if (sinks.length === 0) return;

    const told: QueryEvent = {
      storage,
      sql: event.query.sql,
      parameters: event.query.parameters.length,
      ms: Math.round(event.queryDurationMillis * 1000) / 1000,
      failed: event.level === 'error',
      at: Date.now(),
    };
    // A listener's own failure is not the query's problem — the rule `DispatchLifecycle`
    // applies to an observer, and `Log` in Kysely would otherwise reject the query.
    for (const sink of sinks) {
      try { sink(told); } catch { /* observational */ }
    }
  };
}
