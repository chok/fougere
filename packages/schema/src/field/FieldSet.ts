import { Role } from '../axis/role/Role.js';
import type { CompositeUnique } from '../entity/EntityDeclarations.js';
import { Field, type FieldName, type Fields } from './Field.js';

export class FieldSet<TFields extends Fields = Fields> {
  private constructor(private readonly fields: TFields) {}

  static of<TFields extends Fields>(fields: TFields): FieldSet<TFields> {
    return new FieldSet(fields);
  }

  /**
   * So a declared unique lands where it belongs: on the field, or on the schema.
   * FR : pour qu'une unicité déclarée atterrisse sur le champ ou sur le schéma.
   * `declaring(fields, [['email'], ['listId', 'docId']])`
   * → `email` carries `role.unique`, the pair becomes a schema constraint
   */
  static declaring<TFields extends Fields>(
    declared: TFields,
    unique?: CompositeUnique<TFields>,
  ): { fields: TFields; unique: CompositeUnique<TFields> | undefined } {
    const fields: Fields = {};
    for (const [key, field] of Object.entries(declared))
      fields[key] = new Field(field, key);

    const composite: string[][] = [];
    for (const group of unique ?? []) {
      const missing = group.filter((key) => !(key in fields));
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

    return {
      fields: fields as TFields,
      unique: deduplicated(composite) as CompositeUnique<TFields> | undefined,
    };
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

/** The order is part of a group: `['a','b']` and `['b','a']` are two constraints. */
export function deduplicated(
  groups: readonly (readonly string[])[],
): readonly (readonly string[])[] | undefined {
  const seen = new Map<string, readonly string[]>();
  for (const group of groups) seen.set(group.join(' '), group);

  return seen.size ? [...seen.values()] : undefined;
}
