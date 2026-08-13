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

/**
 * Carry the projected groups across the same key transform — the field-level twin of
 * {@link deriveUnique}, and it has to run with it: the group lives in TWO places once
 * projected (the declaration and each member's role), so remapping one alone left
 * `pick('id','listId')` with a role still claiming a pair whose other member was gone.
 *
 * Same rule as the declaration — a group that lost a member is dropped, not narrowed.
 * The empty self-reference needs no remapping: it names no key, which is exactly why it
 * survives a `rename()` for free.
 */
export function deriveUniqueRoles<TFields extends Fields>(
  fields: TFields,
  mapKey: (key: string) => string | undefined,
): TFields {
  const out = { ...fields } as Fields;
  for (const [key, field] of Object.entries(out)) {
    const groups = field.role?.unique;
    if (!groups?.length) continue;

    const carried = groups
      .map((group) => (group.length === 0 ? [] : group.map(mapKey)))
      .filter((group): group is string[] => group.every((member) => member !== undefined));

    if (carried.length === groups.length) continue;   // nothing lost, keep the field as is
    const { unique: _dropped, ...rest } = field.role!;
    out[key] = field.with({ role: carried.length ? { ...rest, unique: carried } : rest });
  }
  return out as TFields;
}

/**
 * Project the entity's composite groups onto the role of every member — the single
 * place the two ways of stating uniqueness meet.
 *
 * The author writes each fact where it lives: `unique(slug)` on the field it is about,
 * `entity(fields, { unique: [['listId','docId']] })` on the entity, because a fact about
 * a pair is held by neither field alone. Both then read as ONE normal form on the role
 * axis, so every consumer — the DDL, the card, a foreign adapter — has a single shape to
 * handle, and a field belonging to two constraints simply carries two member lists.
 *
 * The entity declaration stays the source (`getUnique()` keeps answering it); this is a
 * projection of it, never a second place to edit. A named member group is spelled out
 * here, while a lone `unique()` keeps its `[]` self-reference — resolved by whoever reads
 * it, which is what makes `rename()` free.
 */
export function projectUniqueOntoFields<TFields extends Fields>(
  fields: TFields,
  groups: CompositeUnique<TFields> | undefined,
): TFields {
  if (!groups || groups.length === 0) return fields;

  const projected = { ...fields } as Fields;
  for (const group of groups) {
    const members = [...group];
    for (const key of members) {
      const field = projected[key];
      if (!field) continue;   // a group naming an absent field states nothing here
      const already = field.role?.unique ?? [];
      projected[key] = field.with({ role: { ...field.role, unique: [...already, members] } });
    }
  }
  return projected as TFields;
}
