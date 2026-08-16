import type { Fields } from "./field.js";
import type { Hints } from "../hints.js";
import { FieldGroup } from "./group.js";

/**
 * Field names that identify at most one row when taken together. No shape can express it —
 * judging one value never sees the other rows — and no handler either: a check then a write
 * is two round trips with room for a concurrent one between them. Only the database keeps it.
 */
export type CompositeUnique<TFields extends Fields> = ReadonlyArray<
  ReadonlyArray<Extract<keyof TFields, string>>
>;

/**
 * What an entity declares about itself, beyond its fields — the 2nd argument of `entity()`.
 *
 * One object rather than a growing parameter list: a second fact about an entity adds a key
 * here, never a positional argument. It is SYNTAX: `entity()` realizes it onto the fields
 * and keeps no copy beside them.
 */
export interface EntityDeclarations<TFields extends Fields> {
  unique?: CompositeUnique<TFields>;
  /** Per-consumer hints, keyed by registered adapter. See {@link Hints}. */
  hints?: Hints<TFields>;
}

/**
 * No two rows carry the same values for these fields together. The first
 * {@link FieldGroup} — it adds a constructor and a slot, and nothing else.
 *
 * ```ts
 * Unique.of('listId', 'docId').members   // → ['listId', 'docId']
 * Unique.self().isSelf                   // → true, until entity() names the carrier
 * FieldGroup.groupsOf(ListBook.getFields(), Unique)  // → [Unique('listId','docId')]
 * ```
 */
export class Unique extends FieldGroup {
  /** Names its members. */
  static of(...members: string[]): Unique {
    return new Unique(members);
  }

  /**
   * The field carrying it, alone. `unique(text())` runs before `entity()` names the field,
   * so the members stay empty until {@link FieldGroup.resolveSelf} fills them in.
   */
  static self(): Unique {
    return new Unique([]);
  }

  protected withMembers(members: readonly string[]): this {
    return new Unique(members) as this;
  }
}
