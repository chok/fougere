import { type FieldName } from './field/FieldName.js';
import { type Fields } from './field/Fields.js';
import { type FieldGroups } from './field/FieldGroups.js';
import type { EntityDeclarations } from './entity/EntityDeclarations.js';

/** What a schema states beyond a single field: groups of field names. */
export type ConstraintKind = (typeof SchemaConstraints.kinds)[number];

export class SchemaConstraints<TFields extends Fields = Fields> {
  static readonly kinds = ['unique', 'index'] as const;

  private constructor(
    readonly unique: FieldGroups<TFields>,
    readonly index: FieldGroups<TFields>,
  ) {}

  static readonly none = new SchemaConstraints([], []);

  /**
   * The groups, without duplicates.
   * Ex: `['a','b']` and `['b','a']` are two groups.
   */
  static of<TFields extends Fields>(
    groups: Pick<EntityDeclarations<TFields>, ConstraintKind>,
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
