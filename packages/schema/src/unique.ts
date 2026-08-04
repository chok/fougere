import type { Fields } from './field/index.js';
import type { Hints } from './hints.js';

/**
 * Field names that identify at most one row when taken together.
 *
 * `unique(field)` states a fact about one column; some facts are about a pair.
 * "A book appears once in a list" is true of `(listId, docId)` and of neither
 * alone, and there is no shape that can express it — judging one value never
 * sees the other rows. So it is declared on the entity and realized by storage.
 *
 * Held here rather than in a handler because a handler cannot hold it: a check
 * followed by a write is two round trips, and a concurrent request fits between
 * them. The database is the only place where the promise is keepable.
 */
export type CompositeUnique<TFields extends Fields> = ReadonlyArray<
  ReadonlyArray<Extract<keyof TFields, string>>
>;

/**
 * What an entity declares about itself, beyond its fields — the 2nd argument of
 * `entity()`.
 *
 * One object rather than a growing parameter list: a second fact about an entity
 * adds a key here, never a positional argument.
 */
export interface EntityDeclarations<TFields extends Fields> {
  /** Field groups that must be unique together. */
  unique?: CompositeUnique<TFields>;
  /** Per-consumer hints, keyed by registered adapter. See {@link Hints}. */
  hints?: Hints<TFields>;
}

/**
 * Carry composite groups across a field-key transform — the entity-level twin of
 * `deriveHints`.
 *
 * A group whose members did not all survive is dropped rather than narrowed: the
 * pair `(listId, docId)` says nothing about `listId` alone, and keeping the
 * remnant would silently state a stronger fact than the author ever wrote.
 */
export function deriveUnique(
  groups: CompositeUnique<Fields> | undefined,
  mapKey: (key: string) => string | undefined,
): CompositeUnique<Fields> | undefined {
  if (!groups) return undefined;

  const carried = groups
    .map((group) => group.map(mapKey))
    .filter((group): group is string[] => group.every((key) => key !== undefined));

  return carried.length > 0 ? carried : undefined;
}
