import { FieldGroup } from "../../constraint/FieldGroup.js";
import { Unique } from "../../constraint/Unique.js";
import type { EntityConstructor, Relation } from "./Relation.js";

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

  private constructor(declared: RoleRules = {}) {
    this.primary = declared.primary;
    this.index = declared.index;
    this.relation = declared.relation;
    this.rules = declared.rules;
  }

  static of(field: { role?: RoleRules }): Role {
    return new Role(field.role);
  }

  /** A group written with no members means "this field": only the key it is declared under resolves it. */
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
    return this.relation?.kind === "many";
  }

  get isReference(): boolean {
    return this.relation?.kind === "one";
  }

  get target(): EntityConstructor | undefined {
    return this.relation?.to();
  }
}
