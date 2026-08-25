import { Role } from './axis/role/Role.js';
import { FieldGroup } from './constraint/FieldGroup.js';
import { Unique } from './constraint/Unique.js';
import type { CompositeUnique } from './EntityDeclarations.js';
import type { Fields } from './Field.js';

export class FieldSet<TFields extends Fields = Fields> {
  private constructor(private readonly fields: TFields) {}

  static of<TFields extends Fields>(fields: TFields): FieldSet<TFields> {
    return new FieldSet(fields);
  }

  /**
   * The name of the field that carries `primary`, or `undefined` when none does.
   *
   * `Role.of(field).isPrimary` answers about ONE field; this answers about a shape, which
   * is the question every reader actually had. It was the same three lines spelled five
   * times — a mirror's key, a form's row identity, GraphQL's node id, the DDL's primary
   * key and the ORM's `findById` column — so a shape with two primaries meant whichever
   * one that loop happened to see first, five times over.
   *
   * The absence is answered and not defaulted: `'id'` is a fine fallback for a form and a
   * lie for a DDL, so the caller decides.
   */
  get primary(): Extract<keyof TFields, string> | undefined {
    const primaries = Object.entries(this.fields)
      .filter(([, field]) => Role.of(field).isPrimary)
      .map(([name]) => name);

    if (primaries.length > 1) {
      throw new Error(
        `FieldSet.primary: ${primaries.map((name) => JSON.stringify(name)).join(', ')} all declare ` +
        '`primary`; a field set can have only one primary field.',
      );
    }

    return primaries[0] as Extract<keyof TFields, string> | undefined;
  }

  get uniqueGroups(): CompositeUnique<TFields> | undefined {
    const groups = FieldGroup.groupsOf(this.fields, Unique);
    return groups.length
      ? groups.map((group) => [...group.members]) as unknown as CompositeUnique<TFields>
      : undefined;
  }
}
