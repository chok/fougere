import type { LogEvent } from 'kysely';
import type { QueryEvent } from './QueryEvent.js';

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

const VERB = /^\s*(\w+)/;

/** Every dialect quotes an identifier its own way, so all three forms are admitted. */
const SUBJECT = /\b(?:from|into|update)\s+["`[]?([\w$.]+)/i;

/**
 * What a statement is ABOUT, read here rather than by each reader: a label wants a table and
 * a verb, and re-reading the sql downstream would be the same regex written twice.
 */
function subjectOf(sql: string): string | undefined {
  return SUBJECT.exec(sql)?.[1];
}

/** The `log` every Kysely is built with. Named by storage, since a sink sees them all. */
export function logQueries(storage: string): (event: LogEvent) => void {
  return (event) => {
    if (sinks.length === 0) return;

    const told: QueryEvent = {
      storage,
      sql: event.query.sql,
      subject: subjectOf(event.query.sql) ?? storage,
      verb: (VERB.exec(event.query.sql)?.[1] ?? 'statement').toLowerCase(),
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
