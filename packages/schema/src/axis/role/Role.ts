import { FieldGroup } from '../../field/constraint/FieldGroup.js';
import { Unique } from '../../field/constraint/Unique.js';
import type { EntityConstructor, Relation } from './Relation.js';

export interface RoleRules {
  primary?: boolean;
  index?: boolean;
  relation?: Relation;
  rules?: readonly FieldGroup[];
}

export class Role implements RoleRules {
  readonly primary?: boolean;
  readonly index?: boolean;
  readonly relation?: Relation;
  readonly rules?: readonly FieldGroup[];

  private constructor(rules: RoleRules = {}) {
    this.primary = rules.primary;
    this.index = rules.index;
    this.relation = rules.relation;
    this.rules = rules.rules;
  }

  static of(field: { role?: RoleRules }): Role {
    return new Role(field.role);
  }

  /** A `unique()` written on a field learns the key it sits under: `Unique([])` → `Unique(['email'])`. */
  static resolvedOn(role: RoleRules | undefined, key?: string): RoleRules | undefined {
    let rules = FieldGroup.normalize(role?.rules, (members) => new Unique(members));
    if (rules && key !== undefined && rules.some((group) => group.isSelf))
      rules = rules.map((group) => group.resolvedOn(key));
    return rules === role?.rules ? role : { ...role, rules };
  }

  get isPrimary(): boolean {
    return this.primary === true;
  }

  get isIndexed(): boolean {
    return this.index === true;
  }

  get isCollection(): boolean {
    return this.relation?.kind === 'many';
  }

  get isReference(): boolean {
    return this.relation?.kind === 'one';
  }

  /** Calls `() => Post` so no caller has to. */
  get target(): EntityConstructor | undefined {
    return this.relation?.to();
  }
}
