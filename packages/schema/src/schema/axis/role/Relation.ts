export type EntityConstructor = abstract new (...args: any[]) => any;

export const RELATION_KINDS = ['one', 'many'] as const;
export const ON_DELETE = ['cascade', 'restrict', 'set null'] as const;

export interface Relation {
  to: () => EntityConstructor;
  kind: (typeof RELATION_KINDS)[number];
  onDelete?: (typeof ON_DELETE)[number];
}

/**
 * How a relation is built — the one place a target becomes a thunk.
 *
 * A target arrives as the class or as a function returning it, because a cycle between two
 * entities can only be written the second way. Recognised by FORM, `getFields` on the
 * value: a class answers it, a thunk does not.
 */
export const Relation = {
  one(target: EntityConstructor | (() => EntityConstructor), cascade?: boolean): Relation {
    return { to: thunk(target), kind: 'one', onDelete: cascade ? 'cascade' : undefined };
  },

  many(target: EntityConstructor | (() => EntityConstructor)): Relation {
    return { to: thunk(target), kind: 'many' };
  },
};

function thunk<E extends EntityConstructor>(target: E | (() => E)): () => E {
  return 'getFields' in target ? () => target as E : (target as () => E);
}
