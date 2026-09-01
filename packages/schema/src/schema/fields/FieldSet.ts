import { Role } from '../axis/role/Role.js';
import { FieldGroup } from './constraint/FieldGroup.js';
import { Unique } from './constraint/Unique.js';
import type { CompositeUnique } from '../../entity/EntityDeclarations.js';
import { Field, type FieldName, type Fields } from './Field.js';

export class FieldSet<TFields extends Fields = Fields> {
  private constructor(private readonly fields: TFields) {}

  static of<TFields extends Fields>(fields: TFields): FieldSet<TFields> {
    return new FieldSet(fields);
  }

  /**
   * Every entry through the field door, then the groups declared over several of them.
   * A group written here names its members; one written on a field named itself, and the
   * key it sat under resolved it.
   */
  static declared<TFields extends Fields>(
    declared: TFields,
    unique?: CompositeUnique<TFields>,
  ): TFields {
    let fields: Fields = {};
    for (const [key, field] of Object.entries(declared))
      fields[key] = new Field(field, key);
    for (const group of unique ?? []) fields = new Unique(group).onto(fields);
    return fields as TFields;
  }

  /**
   * The name of the field that carries `primary`, or `undefined` when none does.
   *
   * `Role.of(field).isPrimary` answers about ONE field; this answers about a shape, which
   * is the question every reader actually had. It was the same three lines spelled five
   * times — a mirror's key, a form's row identity, GraphQL's node id, the DDL's primary
   * key and the storage's `findById` column — so a shape with two primaries meant whichever
   * one that loop happened to see first, five times over.
   *
   * The absence is answered and not defaulted: `'id'` is a fine fallback for a form and a
   * lie for a DDL, so the caller decides.
   */
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
