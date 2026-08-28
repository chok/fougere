import type { LogEvent } from 'kysely';

/** One statement this process ran, and what it cost. */
export interface QueryEvent {
  /** Which storage ran it — a process may open several (`sources:`). */
  storage: string;
  sql: string;
  /**
   * How MANY parameters, never their values.
   *
   * They are user data nobody chose to expose — the rule the call log states for a body.
   * The count is what a reader needs anyway: it is how you see an `IN (?, ?, ?)` grow.
   */
  parameters: number;
  /** Rounded to three decimals: a sub-microsecond statement reports 17 digits otherwise. */
  ms: number;
  failed: boolean;
  at: number;
}

export type QuerySink = (event: QueryEvent) => void;

const sinks: QuerySink[] = [];

/**
 * Be told about every statement this process runs, and get the unsubscription back.
 *
 * A subscription and not an option, for one reason that decides it: Kysely takes its `log`
 * at CONSTRUCTION, and the storage is built during the boot — before any extension's
 * `up(app)` runs. So the only way to subscribe afterwards is for the log to be installed
 * from the start and route to whoever is listening.
 *
 * The same shape core states for `onLog` and observability for `onSpan`. Costs nothing when
 * nobody listens: `logQueries` returns on an empty list before touching the event.
 */
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
