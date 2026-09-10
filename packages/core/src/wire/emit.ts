/** Announcing a fact — the half of the topology `remotes:` never covered. */
import { lowerFirst } from '@fougere/schema';

/**
 * What an emitter injects. PARTIAL, because announcing is what REALIZES the fact's
 * `lifecycle.create` — an `at: created()` is stamped by `Emissions`, so requiring it from
 * the announcer made every emitter cast its way past its own type. A missing field is
 * still refused, by the judge that reads the fact at announce time.
 */
export type Emit<T> = (fact: Partial<T>) => Promise<void>;

/** What a subscriber accepts — and what it PROMISES about itself. */
export type Fact<T> = T;

/**
 * The same fact, BEFORE it is final: an op taking one ANSWERS the value every subscriber
 * then receives, so it is the declared form of what `Emissions.stamped` already does for
 * `created()`.
 *
 * Not a second announcement and not a chain a subscriber joins: the links run once, before
 * anyone is handed anything, which is what keeps a fact the same for every reader.
 */
export type Pipe<T> = T;

/**
 * Asking a subject — the same gesture as announcing, kept: every responder is waited for,
 * and what each answers comes back.
 *
 * Waiting is only possible because the responders are KNOWN: they were read from their
 * signatures at boot. A carrier (`onEmit`) publishes to whoever subscribed elsewhere, so
 * a subject with one cannot be asked — you cannot wait for someone whose existence you
 * do not know, and a deadline would make "nobody answered" look like "everybody agreed".
 */
export type Ask<T> = (question: Partial<T>) => Promise<T[]>;

/**
 * What a responder accepts, and answers. Every one of them answers, and the asker gets
 * them all — no law combines them, which is what `Pipe` had to avoid by admitting one.
 */
export type Answer<T> = T;

/** The container key of an emission — THE one place that spells the format. */
export function emitKeyOf(fact: string): string {
  return `${lowerFirst(fact)}Emit`;
}

/** The container key of a question, spelled here for the same reason. */
export function askKeyOf(subject: string): string {
  return `${lowerFirst(subject)}Ask`;
}

const SUFFIX = 'Emit';
const ASK_SUFFIX = 'Ask';

/** The fact behind an emission key, or `undefined` when the key is not one. */
export function factOfEmitKey(key: string): string | undefined {
  return key.length > SUFFIX.length && key.endsWith(SUFFIX)
    ? key.slice(0, -SUFFIX.length)
    : undefined;
}

/** The subject behind a question key — the dual, asked the same way. */
export function subjectOfAskKey(key: string): string | undefined {
  return key.length > ASK_SUFFIX.length && key.endsWith(ASK_SUFFIX)
    ? key.slice(0, -ASK_SUFFIX.length)
    : undefined;
}

/** What a set of handlers ANNOUNCES — `Emit<T>` read back out of their dependencies. */
export function factsAnnouncedBy(handlers: readonly { deps: readonly string[] }[]): string[] {
  return subjectsIn(handlers, factOfEmitKey);
}

/** What a set of handlers ASKS — the dual, read the same way. */
export function subjectsAskedBy(handlers: readonly { deps: readonly string[] }[]): string[] {
  return subjectsIn(handlers, subjectOfAskKey);
}

function subjectsIn(
  handlers: readonly { deps: readonly string[] }[],
  behind: (key: string) => string | undefined,
): string[] {
  return [...new Set(
    handlers
      .flatMap((handler) => handler.deps)
      .map(behind)
      .filter((subject): subject is string => subject !== undefined),
  )];
}
