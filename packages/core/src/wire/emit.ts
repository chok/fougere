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

/** The container key of an emission — THE one place that spells the format. */
export function emitKeyOf(fact: string): string {
  return `${lowerFirst(fact)}Emit`;
}

const SUFFIX = 'Emit';

/** The fact behind an emission key, or `undefined` when the key is not one. */
export function factOfEmitKey(key: string): string | undefined {
  return key.length > SUFFIX.length && key.endsWith(SUFFIX)
    ? key.slice(0, -SUFFIX.length)
    : undefined;
}

/** What a set of handlers ANNOUNCES — `Emit<T>` read back out of their dependencies. */
export function factsAnnouncedBy(handlers: readonly { deps: readonly string[] }[]): string[] {
  return [...new Set(
    handlers
      .flatMap((handler) => handler.deps)
      .map(factOfEmitKey)
      .filter((fact): fact is string => fact !== undefined),
  )];
}
