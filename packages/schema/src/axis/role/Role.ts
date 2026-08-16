// ─── Axis 2 · role — identity, relations, and what the storage realizes ────
// `rules` and `index` are the only axis members realized OUTSIDE the framework — the DDL
// emits them and the database enforces them, so a collision surfaces as the driver's error,
// never as a `validate()` failure.

import type { FieldGroup } from './FieldGroup.js';
import type { EntityConstructor, Relation } from './Relation.js';

/** What a field DECLARES on the role slot. {@link Role} is this, resolved. */
export interface RoleRules {
  primary?: boolean;
  index?: boolean;
  relation?: Relation;
  /**
   * Every {@link FieldGroup} that names this field, of whatever kind — one list, so a new
   * kind is a subclass and this type does not move. `index` is still a bare boolean: a rule
   * of the same family that cannot yet name several fields.
   */
  rules?: ReadonlyArray<FieldGroup>;
}

/**
 * A field's place in the entity graph, resolved — the questions its readers kept asking by
 * hand. Measured before writing: 42 sites across five packages took `role.relation.kind`,
 * `role.primary` and `role.relation.to()` apart, and not one of them named what it wanted.
 *
 * ```ts
 * Role.of(fields.id).isPrimary          // → true
 * Role.of(fields.posts).isCollection    // → true   (a `many` relation)
 * Role.of(fields.author).target?.name   // → 'Author'
 * ```
 */
export class Role implements RoleRules {
  readonly primary?: boolean;
  readonly index?: boolean;
  readonly relation?: Relation;
  readonly rules?: ReadonlyArray<FieldGroup>;

  private constructor(declared: RoleRules = {}) {
    this.primary = declared.primary;
    this.index = declared.index;
    this.relation = declared.relation;
    this.rules = declared.rules;
  }

  static of(field: { role?: RoleRules }): Role {
    return new Role(field.role);
  }

  /** Identity — the storage owns it, and a client never supplies it. */
  get isPrimary(): boolean {
    return this.primary === true;
  }

  /** The DDL emits a separate index for it. A primary or a sole unique already has one. */
  get isIndexed(): boolean {
    return this.index === true;
  }

  /** A `many` relation — the collection lives on the OTHER side, so this field holds no column. */
  get isCollection(): boolean {
    return this.relation?.kind === 'many';
  }

  /** A `one` relation — this field holds the foreign key. */
  get isReference(): boolean {
    return this.relation?.kind === 'one';
  }

  /** The related entity, the thunk already called. Absent when the field holds no relation. */
  get target(): EntityConstructor | undefined {
    return this.relation?.to();
  }
}
