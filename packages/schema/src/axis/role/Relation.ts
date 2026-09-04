export type EntityConstructor = abstract new (...args: any[]) => any;

export const RELATION_KINDS = ['one', 'many'] as const;
export const ON_DELETE = ['cascade', 'restrict', 'set null'] as const;

export interface Relation {
  to: () => EntityConstructor;
  kind: (typeof RELATION_KINDS)[number];
  onDelete?: (typeof ON_DELETE)[number];
}

/**
 * How a relation is built — the one place a target becomes `() => Entity`.
 *
 * A target arrives as the class or as a function returning it, because a cycle between two
 * entities can only be written the second way. Recognised by FORM, `getFields` on the
 * value: a class answers it, `() => Post` does not.
 */
export const Relation = {
  /**
   * So two entities can point at each other, which a bare class reference cannot express.
   * FR : pour que deux entités se pointent l'une l'autre, ce qu'une classe nue interdit.
   * `Relation.one(() => User, true)` → `{ to: () => User, kind: 'one', onDelete: 'cascade' }`
   */
  one(target: EntityConstructor | (() => EntityConstructor), cascade?: boolean): Relation {
    return { to: normalizeTarget(target), kind: 'one', onDelete: cascade ? 'cascade' : undefined };
  },

  /**
   * So the many side is declared exactly like the one side, `() => Post` included.
   * FR : pour que le côté « plusieurs » se déclare comme le côté « un ».
   * `Relation.many(Post)` → `{ to: () => Post, kind: 'many' }`
   */
  many(target: EntityConstructor | (() => EntityConstructor)): Relation {
    return { to: normalizeTarget(target), kind: 'many' };
  },
};

function normalizeTarget<E extends EntityConstructor>(target: E | (() => E)): () => E {
  return 'getFields' in target ? () => target as E : (target as () => E);
}
