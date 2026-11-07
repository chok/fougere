import { Role } from '../axis/role/Role.js';
import type { FieldGroups } from './FieldGroups.js';
import { Field } from './Field.js';
import { type FieldName } from './FieldName.js';
import { type Fields } from './Fields.js';
import { SchemaError } from '../SchemaError.js';
import { SchemaConstraints, type ConstraintKind } from '../SchemaConstraints.js';

export class FieldSet<TFields extends Fields = Fields> {
  private constructor(private readonly fields: TFields) {}

  static of<TFields extends Fields>(fields: TFields): FieldSet<TFields> {
    return new FieldSet(fields);
  }

  /** Splits the declared groups: a group of one goes on its field, several stay on the schema. */
  static declaring<TFields extends Fields>(
    declared: TFields,
    groups: Partial<Record<ConstraintKind, FieldGroups<TFields>>> = {},
  ): { fields: TFields } & Record<ConstraintKind, FieldGroups<TFields>> {
    const fields: Fields = {};
    for (const [key, field] of Object.entries(declared))
      fields[key] = new Field(field, key);

    const composite: Record<ConstraintKind, FieldName<TFields>[][]> = { unique: [], index: [] };

    for (const kind of SchemaConstraints.kinds) {
      for (const group of groups[kind] ?? []) {
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
        `${primaries.map((name) => `'${name}'`).join(' and ')} are ${primaries.length === 2 ? 'both' : 'all'} primary(). An entity has one primary field.`,
      );
    }

    return primaries[0] as FieldName<TFields> | undefined;
  }

}
