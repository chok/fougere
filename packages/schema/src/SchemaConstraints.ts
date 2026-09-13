import { type FieldName } from './field/FieldName.js';
import { type Fields } from './field/Fields.js';
import { type CompositeUnique } from './entity/CompositeUnique.js';

/**
 * What a schema constrains beyond any single field.
 *
 * `unique` is the one member today. It sits under an owner rather than beside `fields`
 * and `opts` because the next rule spanning two fields — a check, an exclusion — is a
 * member here, not an eighth positional argument in a list that has already lost one.
 */
export class SchemaConstraints<TFields extends Fields = Fields> {
  readonly unique?: CompositeUnique<TFields>;

  private constructor(unique?: CompositeUnique<TFields>) {
    if (unique) this.unique = unique;
  }

  static readonly none = new SchemaConstraints();

  /**
   * The order is part of a group, so `['a','b']` and `['b','a']` are two constraints.
   * FR : l'ordre fait partie du groupe : `['a','b']` et `['b','a']` sont deux contraintes.
   * `SchemaConstraints.of([['a','b'], ['a','b']])` → `unique` holds one group
   */
  static of<TFields extends Fields>(
    groups: readonly (readonly FieldName<TFields>[])[],
  ): SchemaConstraints<TFields> {
    const seen = new Map<string, readonly FieldName<TFields>[]>();
    for (const group of groups) seen.set(JSON.stringify(group), group);

    return new SchemaConstraints(seen.size ? [...seen.values()] : undefined);
  }

  /** One member gone and the group is gone: it constrained a pair that no longer exists. */
  renamed(transform: (key: string) => string | undefined): SchemaConstraints {
    if (!this.unique) return SchemaConstraints.none;
    const kept: string[][] = [];
    for (const group of this.unique) {
      const renamed = group.map(transform);
      if (renamed.every((key): key is string => key !== undefined)) kept.push(renamed);
    }

    return SchemaConstraints.of(kept);
  }
}
