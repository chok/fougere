import type { EntityConstructor, Relation } from './Relation.js';

export interface RoleRules {
  primary?: boolean;
  index?: boolean;
  unique?: boolean;
  relation?: Relation;
}

export class Role implements RoleRules {
  readonly primary?: boolean;
  readonly index?: boolean;
  readonly unique?: boolean;
  readonly relation?: Relation;

  private constructor(rules: RoleRules = {}) {
    this.primary = rules.primary;
    this.index = rules.index;
    this.unique = rules.unique;
    this.relation = rules.relation;
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

  /** A field unique on its own. A group spanning several belongs to the schema. */
  get isUnique(): boolean {
    return this.unique === true;
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
