import type { FieldGroup } from "../../constraint/FieldGroup.js";
import type { Fields } from "../../Field.js";
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
export function primaryFieldOf(fields: Fields): string | undefined {
  for (const [name, field] of Object.entries(fields)) {
    if (Role.of(field).isPrimary) return name;
  }
  return undefined;
}
