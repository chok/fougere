import { FieldGroup } from "../../fields/constraint/FieldGroup.js";
import { Unique } from "../../fields/constraint/Unique.js";
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

  /**
   * So a question about a role is asked of the role, not of a raw object full of holes.
   * FR : pour qu'une question sur un rôle soit posée au rôle, pas à un objet brut.
   * `Role.of(id).isPrimary` → `true`
   */
  static of(field: { role?: RoleRules }): Role {
    return new Role(field.role);
  }

  /**
   * So `unique()` written on a field learns the name it was declared under.
   * FR : pour qu'un `unique()` apprenne le nom sous lequel il a été déclaré.
   * `resolvedOn({ rules: [new Unique([])] }, 'email')` → the group becomes `['email']`
   */
  static resolvedOn(role: RoleRules | undefined, key?: string): RoleRules | undefined {
    let rules = FieldGroup.normalize(role?.rules, (members) => new Unique(members));
    if (rules && key !== undefined && rules.some((group) => group.isSelf))
      rules = rules.map((group) => group.resolvedOn(key));
    return rules === role?.rules ? role : { ...role, rules };
  }

  /**
   * So `primary` reads as yes or no, never as an `undefined` every caller has to handle.
   * FR : pour que `primary` se lise en oui ou non, jamais en `undefined`.
   * `Role.of(text()).isPrimary` → `false`
   */
  get isPrimary(): boolean {
    return this.primary === true;
  }

  /**
   * So a DDL asks one question and gets a boolean, whatever the field left undeclared.
   * FR : pour qu'un DDL pose une question et reçoive un booléen.
   * `Role.of(email).isIndexed` → `true` when `email` declares `index`
   */
  get isIndexed(): boolean {
    return this.index === true;
  }

  /**
   * So a reader asks whether a field holds many rows without knowing how a relation is spelled.
   * FR : pour qu'on demande si un champ porte plusieurs lignes, sans lire la relation.
   * `Role.of(posts).isCollection` → `true`
   */
  get isCollection(): boolean {
    return this.relation?.kind === "many";
  }

  /**
   * So the one side is asked the same way as the many side, and the two never diverge.
   * FR : pour que le côté « un » se demande comme le côté « plusieurs ».
   * `Role.of(author).isReference` → `true`
   */
  get isReference(): boolean {
    return this.relation?.kind === "one";
  }

  /**
   * So the entity at the other end is reached without any caller calling the thunk itself.
   * FR : pour qu'on atteigne l'entité d'en face sans appeler le thunk soi-même.
   * `Role.of(author).target` → `User`
   */
  get target(): EntityConstructor | undefined {
    return this.relation?.to();
  }
}
