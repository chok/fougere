import type { Entity } from '../../entity/Entity.js';
import type { RoleRules } from './Role.js';

export const RELATION_KINDS = ['one', 'many'] as const;

export const ON_DELETE = ['cascade', 'restrict', 'set null'] as const;

/** What becomes of the rows that name a deleted one. */
export type OnDelete = (typeof ON_DELETE)[number];

export type Relation = NonNullable<RoleRules['relation']>;

/**
 * How a relation is built — the one place a target becomes `() => Entity`.
 *
 * A target arrives as the class or as a function returning it, because a cycle between two
 * entities can only be written the second way. Recognised by FORM, `getFields` on the
 * value: a class answers it, `() => Post` does not.
 */
export const Relation = {
  /** `() => Post` so two entities can point at each other. */
  one(target: Entity | (() => Entity), onDelete?: OnDelete): Relation {
    return { to: normalizeTarget(target), kind: 'one', ...(onDelete ? { onDelete } : {}) };
  },

  many(target: Entity | (() => Entity)): Relation {
    return { to: normalizeTarget(target), kind: 'many' };
  },
};

function normalizeTarget<E extends Entity>(target: E | (() => E)): () => E {
  return 'getFields' in target ? () => target as E : (target as () => E);
}
