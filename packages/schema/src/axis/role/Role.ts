import type { Relation } from './Relation.js';
import type { EntityConstructor } from './EntityConstructor.js';
import { isObject } from '../../lib/utils.js';
import { Shapes, type Shape } from '../shape/Shape.js';
import type { ValidationError } from '../../lib/ValidationError.js';
import { Format, type Accepted } from '../../lib/Format.js';
import { ON_DELETE, RELATION_KINDS } from './Relation.js';

export class Role {
  static readonly format = Format.of('axis/role')
    .key('primary', Format.flag)
    .key('index', Format.flag)
    .key('unique', Format.flag)
    .key(
      'relation',
      Format.of()
        .key('to', Format.anything.as<() => EntityConstructor>())
        .key('kind', Format.tokens(RELATION_KINDS))
        .key('onDelete', Format.tokens(ON_DELETE))
        .needs('to', 'kind')
        .closed(),
    )
    .closed();

  static refusals(value: unknown, declaration: Record<string, unknown> = {}): ValidationError[] {
    const role = Role.of({ role: isObject(value) ? (value as RoleRules) : undefined });
    const errors: ValidationError[] = [];
    const relation = isObject(value) ? value.relation : undefined;

    if (isObject(relation) && 'to' in relation && typeof relation.to !== 'function')
      errors.push({
        path: ['role', 'relation', 'to'],
        message: 'Expected a function returning the target entity, such as () => Post',
      });

    if (role.isPrimary && Shapes.isNullable(declaration.shape as Shape))
      errors.push({
        path: ['role', 'primary'],
        message: 'A primary key admits no null — a row is addressed by it',
      });

    if (role.isCollection && (role.isUnique || role.isIndexed))
      errors.push({
        path: ['role', role.isUnique ? 'unique' : 'index'],
        message: 'A collection has no column of its own, so there is nothing to index',
      });

    return errors;
  }

  private constructor(private readonly rules: RoleRules = {}) {}

  /** A collection has no column: the far side of the relation carries the key. */
  static admitsAbsence(field: { role?: RoleRules }): boolean {
    return this.of(field).isCollection;
  }

  static of(field: { role?: RoleRules }): Role {
    return new Role(field.role);
  }

  get isPrimary(): boolean {
    return this.rules.primary === true;
  }

  get isIndexed(): boolean {
    return this.rules.index === true;
  }

  /** A field unique on its own. A group spanning several belongs to the schema. */
  get isUnique(): boolean {
    return this.rules.unique === true;
  }

  get isCollection(): boolean {
    return this.rules.relation?.kind === 'many';
  }

  get isReference(): boolean {
    return this.rules.relation?.kind === 'one';
  }

  /** Either kind — what a CLI flag and a GraphQL selection both leave out. */
  get isRelation(): boolean {
    return this.rules.relation !== undefined;
  }

  /** Calls `() => Post` so no caller has to. */
  get target(): EntityConstructor | undefined {
    return this.rules.relation?.to();
  }

  get onDelete(): Relation['onDelete'] {
    return this.rules.relation?.onDelete;
  }
}

export type RoleRules = Accepted<typeof Role.format>;

declare module '../../FougereFieldAxes.js' {
  interface FougereFieldAxes {
    readonly role?: RoleRules;
  }
}
