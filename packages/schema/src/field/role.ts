// ─── Axis 2 · role — place in the entity graph ────────────
// What no value validator expresses: identity and relations. Read by the storage and
// transport adapters, and ALSO by validation — `relation.kind === 'many'` decides that
// an absent collection defaults to `[]` and that a supplied one must be an array
// (`projections/validation.ts`). The earlier claim "never by validation" was false.
//
// `unique` and `index` are STORAGE facts, and the only axis member realized outside the
// framework: `unique(...)`/`indexed(...)` set them, the DDL emits the constraint and the
// index, and the database enforces uniqueness on every write — including ones Fougere
// never saw. A collision therefore surfaces as the driver's error, never as a
// `validate()` failure: judging one value can never see the other rows.

export type EntityConstructor = abstract new (...args: any[]) => any;

/**
 * Normalize a relation target to a lazy thunk. A target may be given as the entity
 * class directly (`ref(Author)`) or as a thunk (`ref(() => Author)`) — the thunk
 * form is needed for circular/forward references, where the class isn't defined yet
 * when `entity({...})` is evaluated. An entity class is recognized by its static
 * `getFields`; anything else is treated as the thunk itself.
 */
export function toTargetThunk<E extends EntityConstructor>(target: E | (() => E)): () => E {
  return 'getFields' in target ? () => target as E : (target as () => E);
}

export interface Relation {
  to: () => EntityConstructor;
  kind: 'one' | 'many';
  onDelete?: 'cascade' | 'restrict' | 'set null';
}

export interface Role {
  primary?: boolean;
  /**
   * The unique constraints this field is a member of — one member list per constraint.
   *
   * A constraint is a NAMED SET of fields, and a lone `unique(slug)` is the degenerate
   * case: a set of one. So there is one shape, not two — `boolean` could say "unique on
   * its own" and nothing else, neither "unique together with docId" nor "in two
   * constraints at once".
   *
   * **An empty member list denotes the field carrying it.** `unique(text())` applies to a
   * field that does not yet know its own key — `slug` exists only once `entity({...})`
   * assembles the object — so the self-reference is written as `[]` and stays that way:
   * nothing to resolve, nothing to remap when a view renames the key, and a reader that
   * never went through `entity()` still reads something true. A group with named members
   * comes from the entity's own declaration (`entity(fields, { unique: [[...]] })`), which
   * is where a fact about a pair belongs — no field holds it alone.
   */
  unique?: ReadonlyArray<ReadonlyArray<string>>;
  index?: boolean;
  relation?: Relation;
}

/** The constraint a member list denotes, resolved against the field carrying it. */
export function uniqueMembers(group: ReadonlyArray<string>, ownKey: string): string[] {
  return group.length === 0 ? [ownKey] : [...group];
}
