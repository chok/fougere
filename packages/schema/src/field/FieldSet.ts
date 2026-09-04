import { Role } from '../axis/role/Role.js';
import { FieldGroup } from './constraint/FieldGroup.js';
import { Unique } from './constraint/Unique.js';
import type { CompositeUnique } from '../entity/EntityDeclarations.js';
import { Field, type FieldName, type Fields } from './Field.js';

export class FieldSet<TFields extends Fields = Fields> {
  private constructor(private readonly fields: TFields) {}

  /**
   * So a question about a whole set is asked of the set, not of each field in turn.
   * FR : pour qu'une question sur l'ensemble soit posée à l'ensemble.
   * `FieldSet.of({ id: primary(), title: text() }).primary` → `'id'`
   */
  static of<TFields extends Fields>(fields: TFields): FieldSet<TFields> {
    return new FieldSet(fields);
  }

  /**
   * So a group written on the entity and a group written on a field end up the same thing.
   * FR : pour qu'un groupe écrit sur l'entité et un écrit sur un champ soient pareils.
   * `withUnique({ id: primary(), email: text(), tenant: text() }, [['email', 'tenant']])`
   * → `email` and `tenant` both carry one group
   */
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

  /**
   * So one shape has one identity, and a second `primary` is a refusal rather than a coin toss.
   * FR : pour qu'une forme ait une identité, un second `primary` étant un refus.
   * `{ id: primary(), title: text() }` → `'id'`; two primaries → throws, naming both
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

  /**
   * So a card can carry the groups back out, read off the fields that hold them.
   * FR : pour qu'une carte ressorte les groupes, lus sur les champs qui les portent.
   * `{ email, tenant }` both carrying one group → `[['email', 'tenant']]`
   */
  get uniqueGroups(): CompositeUnique<TFields> | undefined {
    const groups = FieldGroup.groupsOf(this.fields, Unique);
    return groups.length
      ? (groups.map((group) => [...group.members]) as unknown as CompositeUnique<TFields>)
      : undefined;
  }
}
