import type { Fields } from './field/index.js';
import type { Hints } from './hints.js';

/**
 * Field names that identify at most one row when taken together. No shape can express it —
 * judging one value never sees the other rows — and no handler either: a check then a write
 * is two round trips with room for a concurrent one between them. Only the database keeps it.
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
  unique?: CompositeUnique<TFields>;
  /** Per-consumer hints, keyed by registered adapter. See {@link Hints}. */
  hints?: Hints<TFields>;
}

/**
 * Carry composite groups across a key transform. A group that lost a member is DROPPED,
 * not narrowed: `(listId, docId)` says nothing about `listId` alone.
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
 * The same, on each member's role — it must run WITH {@link deriveUnique}: once projected
 * the group lives in two places, so remapping one alone left a role claiming a pair whose
 * other member was gone. The empty self-reference names no key, so it needs no remapping.
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
 * Project the entity's composite groups onto every member's role — the single place the
 * two ways of stating uniqueness meet, so every consumer has one shape to handle.
 *
 * The entity declaration stays the source (`getUnique()` answers it); this is a projection,
 * never a second place to edit.
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
