export type EntityConstructor = abstract new (...args: any[]) => any;

export function toTargetThunk<E extends EntityConstructor>(target: E | (() => E)): () => E {
  return 'getFields' in target ? () => target as E : (target as () => E);
}

export const RELATION_KINDS = ['one', 'many'] as const;
export const ON_DELETE = ['cascade', 'restrict', 'set null'] as const;

export interface Relation {
  to: () => EntityConstructor;
  kind: (typeof RELATION_KINDS)[number];
  onDelete?: (typeof ON_DELETE)[number];
}
