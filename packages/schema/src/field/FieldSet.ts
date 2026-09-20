import { Role } from '../axis/role/Role.js';
import type { FieldGroups } from '../entity/FieldGroups.js';
import { Field } from './Field.js';
import { type FieldName } from './FieldName.js';
import { type Fields } from './Fields.js';
import { SchemaError } from '../SchemaError.js';

export class FieldSet<TFields extends Fields = Fields> {
  private constructor(private readonly fields: TFields) {}

  static of<TFields extends Fields>(fields: TFields): FieldSet<TFields> {
    return new FieldSet(fields);
  }

  /**
   * Splits a declared `unique`: a group of one lands on the field, several stay on the schema.
   * FR : partage un `unique` déclaré : un groupe d'un va au champ, plusieurs restent au schéma.
   * `declaring(fields, [['email'], ['listId', 'docId']])` → `email` carries it, the pair is a group
   */
  /**
   * A group of ONE is the word on the field — `unique: [['slug']]` is `unique(text())` — so it
   * is written there and never kept as a group, which is what lets a derivation drop it with
   * its field. A group of several is what no single field can state, and it is kept whole.
   */
  static declaring<TFields extends Fields>(
    declared: TFields,
    stated: { unique?: FieldGroups<TFields>; index?: FieldGroups<TFields> } = {},
  ): { fields: TFields; unique: FieldGroups<TFields>; index: FieldGroups<TFields> } {
    const fields: Fields = {};
    for (const [key, field] of Object.entries(declared))
      fields[key] = new Field(field, key);

    const composite = { unique: [] as FieldName<TFields>[][], index: [] as FieldName<TFields>[][] };

    for (const kind of ['unique', 'index'] as const) {
      for (const group of stated[kind] ?? []) {
        const missing = group.filter((key) => !Object.hasOwn(fields, key));
        if (missing.length)
          throw new SchemaError(
            `${kind}: [${group.join(', ')}] names ` +
              `${missing.map((key) => `'${key}'`).join(', ')}, which the entity does not declare.`,
          );

        if (group.length === 1) {
          const key = group[0]!;
          const alone = fields[key]!;
          fields[key] = alone.with({ role: { ...alone.role, [kind]: true } });
          continue;
        }
        composite[kind].push([...group]);
      }
    }

    return { fields: fields as TFields, unique: composite.unique, index: composite.index };
  }

  /** A second `primary` is refused, naming both, rather than the first winning silently. */
  get primary(): FieldName<TFields> | undefined {
    const primaries = Object.entries(this.fields)
      .filter(([, field]) => Role.of(field).isPrimary())
      .map(([name]) => name);

    if (primaries.length > 1) {
      throw new SchemaError(
        `FieldSet.primary: ${primaries.map((name) => JSON.stringify(name)).join(', ')} all declare ` +
          '`primary`; a field set can have only one primary field.',
      );
    }

    return primaries[0] as FieldName<TFields> | undefined;
  }

}
