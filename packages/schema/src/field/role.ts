// ─── Axis 2 · role — DOMAIN / PERSISTENCE meaning ────────────
// What no value validator expresses: identity, relations, persistence
// intentions. Read by storage/transport adapters, never by validation.

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
