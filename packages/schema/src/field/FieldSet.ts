import { Role } from '../axis/role/Role.js';
import type { CompositeUnique } from '../entity/EntityDeclarations.js';
import { Field, type FieldName, type Fields } from './Field.js';

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
  static declaring<TFields extends Fields>(
    declared: TFields,
    unique?: CompositeUnique<TFields>,
  ): { fields: TFields; groups: CompositeUnique<TFields> } {
    const fields: Fields = {};
    for (const [key, field] of Object.entries(declared))
      fields[key] = new Field(field, key);

    const composite: FieldName<TFields>[][] = [];
    for (const group of unique ?? []) {
      const missing = group.filter((key) => !Object.hasOwn(fields, key));
      if (missing.length)
        throw new Error(
          `unique: [${group.join(', ')}] names ` +
            `${missing.map((key) => `'${key}'`).join(', ')}, which the entity does not declare.`,
        );

      if (group.length === 1) {
        const key = group[0]!;
        fields[key] = fields[key]!.with({ role: { ...fields[key]!.role, unique: true } });
        continue;
      }
      composite.push([...group]);
    }

    return { fields: fields as TFields, groups: composite };
  }

  /** A second `primary` is refused, naming both, rather than the first winning silently. */
  get primary(): FieldName<TFields> | undefined {
    const primaries = Object.entries(this.fields)
      .filter(([, field]) => Role.of(field).isPrimary)
      .map(([name]) => name);

    if (primaries.length > 1) {
      throw new Error(
        `FieldSet.primary: ${primaries.map((name) => JSON.stringify(name)).join(', ')} all declare ` +
          '`primary`; a field set can have only one primary field.',
      );
    }

    return primaries[0] as FieldName<TFields> | undefined;
  }

}
