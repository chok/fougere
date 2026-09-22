import { type FieldName } from './field/FieldName.js';
import { type Fields } from './field/Fields.js';
import { type FieldGroups } from './entity/FieldGroups.js';

/**
 * What a schema states beyond any single field: groups of names. `unique` constrains the
 * rows, `index` says how they are reached — two decisions, and neither implies the other.
 * They sit under an owner rather than beside `fields` and `opts` because the next rule
 * spanning two fields — a check, an exclusion — is a member here, not an eighth positional
 * argument in a list that has already lost one.
 */
export class SchemaConstraints<TFields extends Fields = Fields> {
  private constructor(
    readonly unique: FieldGroups<TFields>,
    readonly index: FieldGroups<TFields>,
  ) {}

  static readonly none = new SchemaConstraints([], []);

  /**
   * The order is part of a group, so `['a','b']` and `['b','a']` are two constraints.
   * FR : l'ordre fait partie du groupe : `['a','b']` et `['b','a']` sont deux contraintes.
   * `SchemaConstraints.of([['a','b'], ['a','b']])` → `unique` holds one group
   */
  static of<TFields extends Fields>(
    groups: { unique?: FieldGroups<TFields>; index?: FieldGroups<TFields> },
  ): SchemaConstraints<TFields> {
    return new SchemaConstraints(deduped(groups.unique), deduped(groups.index));
  }

  /** One member gone and the group is gone: it named a pair that no longer exists. */
  renamed(transform: (key: string) => string | undefined): SchemaConstraints {
    return SchemaConstraints.of({
      unique: survivors(this.unique, transform),
      index: survivors(this.index, transform),
    });
  }
}

const deduped = <TFields extends Fields>(
  groups: FieldGroups<TFields> = [],
): FieldGroups<TFields> => {
  const seen = new Map<string, readonly FieldName<TFields>[]>();
  for (const group of groups) seen.set(JSON.stringify(group), group);

  return [...seen.values()];
};

const survivors = (
  groups: FieldGroups<Fields>,
  transform: (key: string) => string | undefined,
): string[][] => {
  const kept: string[][] = [];
  for (const group of groups) {
    const renamed = group.map(transform);
    if (renamed.every((key): key is string => key !== undefined)) kept.push(renamed);
  }

  return kept;
};
