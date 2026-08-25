import type { FieldGroup } from "../../constraint/FieldGroup.js";
import type { EntityConstructor, Relation } from "./Relation.js";

export interface RoleRules {
  primary?: boolean;
  index?: boolean;
  relation?: Relation;
  rules?: ReadonlyArray<FieldGroup>;
}

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
