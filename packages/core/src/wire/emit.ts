/** Announcing a fact — the half of the topology `remotes:` never covered. */
import { lowerFirst } from '@fougere/schema';

/**
 * What an emitter injects. PARTIAL, because announcing is what REALIZES the fact's
 * `lifecycle.create` — an `at: created()` is stamped by `Emissions`, so requiring it from
 * the announcer made every emitter cast its way past its own type. A missing field is
 * still refused, by the judge that reads the fact at announce time.
 */
export type Emit<T, A = never> = (fact: Partial<T>) => Promise<A[]>;

/**
 * What a subscriber accepts — and what it PROMISES about itself.
 *
 * What it ANSWERS is its own to choose: `Promise<void>` says nothing, any other type is an
 * opinion. It reaches an announcer that asked for one — `Emit<CanBook, Verdict>` — and
 * nobody otherwise, since a plain announcement does not wait.
 */
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

/** The container key of an emission — THE one place that spells the format. */
export function emitKeyOf(fact: string): string {
  return `${lowerFirst(fact)}Emit`;
}

/**
 * The key of an emission that WAITS — `Emit<CanBook, Verdict>`, where the second type is
 * the whole difference. A separate key because they are two functions: one hands the fact
 * over and returns, the other waits for every subscriber and gives back what they said.
 */
export function awaitKeyOf(fact: string): string {
  return `${lowerFirst(fact)}Await`;
}

const SUFFIX = 'Emit';
const AWAIT_SUFFIX = 'Await';

/** The fact behind an emission key, or `undefined` when the key is not one. */
export function factOfEmitKey(key: string): string | undefined {
  return behind(key, SUFFIX);
}

/** The fact behind an awaited emission's key — the dual, read the same way. */
export function factOfAwaitKey(key: string): string | undefined {
  return behind(key, AWAIT_SUFFIX);
}

function behind(key: string, suffix: string): string | undefined {
  return key.length > suffix.length && key.endsWith(suffix)
    ? key.slice(0, -suffix.length)
    : undefined;
}

/** What a set of handlers ANNOUNCES — `Emit<T>` read back out of their dependencies. */
export function factsAnnouncedBy(handlers: readonly { deps: readonly string[] }[]): string[] {
  return factsIn(handlers, factOfEmitKey);
}

/** What a set of handlers announces AND WAITS FOR — the same reading, one suffix apart. */
export function factsAwaitedBy(handlers: readonly { deps: readonly string[] }[]): string[] {
  return factsIn(handlers, factOfAwaitKey);
}

function factsIn(
  handlers: readonly { deps: readonly string[] }[],
  behindKey: (key: string) => string | undefined,
): string[] {
  return [...new Set(
    handlers
      .flatMap((handler) => handler.deps)
      .map(behindKey)
      .filter((fact): fact is string => fact !== undefined),
  )];
}
