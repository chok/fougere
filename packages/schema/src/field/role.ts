// ─── Axis 2 · role — place in the entity graph ────────────
// What no value validator expresses: identity and relations. Read by the storage and
// transport adapters, and ALSO by validation — `relation.kind === 'many'` decides that
// an absent collection defaults to `[]` and that a supplied one must be an array
// (`projections/validation.ts`). The earlier claim "never by validation" was false.
//
// `unique` and `index` are DEAD: no vocabulary word produces them, no DDL emits them,
// no consumer decides on them — `describe`/`reconstruct` merely carry them, so a
// portable card can promise a uniqueness nothing enforces. They are storage hints
// wearing a graph axis; `hints` is their home. Remove rather than implement here.

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
  unique?: boolean;
  index?: boolean;
  relation?: Relation;
}
