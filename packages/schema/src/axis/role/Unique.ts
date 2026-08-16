import type { Fields } from '../../Field.js';
import { FieldGroup } from './FieldGroup.js';

/**
 * No two rows carry the same values for these fields together. The first
 * {@link FieldGroup} — it adds a constructor and a slot, and nothing else.
 *
 * ```ts
 * Unique.of('listId', 'docId').members   // → ['listId', 'docId']
 * Unique.self().isSelf                   // → true, until entity() names the carrier
 * FieldGroup.groupsOf(ListBook.getFields(), Unique)  // → [Unique('listId','docId')]
 * ```
 */
export class Unique extends FieldGroup {
  /** Names its members. */
  static of(...members: string[]): Unique {
    return new Unique(members);
  }

  /**
   * The field carrying it, alone. `unique(text())` runs before `entity()` names the field,
   * so the members stay empty until {@link FieldGroup.resolveSelf} fills them in.
   */
  static self(): Unique {
    return new Unique([]);
  }

  protected withMembers(members: readonly string[]): this {
    return new Unique(members) as this;
  }
}
