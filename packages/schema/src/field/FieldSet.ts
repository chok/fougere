import { Role } from '../axis/role/Role.js';
import { FieldGroup } from './constraint/FieldGroup.js';
import { Unique } from './constraint/Unique.js';
import type { CompositeUnique } from '../entity/EntityDeclarations.js';
import { Field, type FieldName, type Fields } from './Field.js';

export class FieldSet<TFields extends Fields = Fields> {
  private constructor(private readonly fields: TFields) {}

  static of<TFields extends Fields>(fields: TFields): FieldSet<TFields> {
    return new FieldSet(fields);
  }

  static withUnique<TFields extends Fields>(
    declared: TFields,
    unique?: CompositeUnique<TFields>,
  ): TFields {
    let fields: Fields = {};
    for (const [key, field] of Object.entries(declared))
      fields[key] = new Field(field, key);
    for (const group of unique ?? []) fields = new Unique(group).onto(fields);
    return fields as TFields;
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

  get uniqueGroups(): CompositeUnique<TFields> | undefined {
    const groups = FieldGroup.groupsOf(this.fields, Unique);
    return groups.length
      ? (groups.map((group) => [...group.members]) as unknown as CompositeUnique<TFields>)
      : undefined;
  }
}
