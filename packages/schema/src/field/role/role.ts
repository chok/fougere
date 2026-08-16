// ─── Axis 2 · role — place in the entity graph ────────────
// Identity and relations. Read by the storage and transport adapters, and by the judge:
// `relation.kind === 'many'` makes an absent collection default to `[]`.
//
// `unique` and `index` are the only axis members realized OUTSIDE the framework — the DDL
// emits them and the database enforces them, so a collision surfaces as the driver's
// error, never as a `validate()` failure.

import type { FieldGroup } from './group.js';

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

export interface Role {
  primary?: boolean;
  index?: boolean;
  relation?: Relation;
  /**
   * Every {@link FieldGroup} that names this field, of whatever kind — one list, so a new
   * kind is a subclass and this type does not move. `index` is still a bare boolean: a rule
   * of the same family that cannot yet name several fields.
   */
  rules?: ReadonlyArray<FieldGroup>;
}

