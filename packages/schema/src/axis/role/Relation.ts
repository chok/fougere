// ─── The relation — a field's place in the entity GRAPH ────
// Read by the storage and transport adapters, and by the judge: `kind === 'many'` makes an
// absent collection default to `[]`. Its target is a THUNK, never the class: that is what
// lets a circular relation resolve.

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

/** A relation's closed vocabularies — the runtime lists the types derive from. */
export const RELATION_KINDS = ['one', 'many'] as const;
export const ON_DELETE = ['cascade', 'restrict', 'set null'] as const;

export interface Relation {
  to: () => EntityConstructor;
  kind: (typeof RELATION_KINDS)[number];
  onDelete?: (typeof ON_DELETE)[number];
}
