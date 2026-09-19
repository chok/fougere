import type { Relation } from './Relation.js';
import type { EntityConstructor } from './EntityConstructor.js';
import { isObject } from '../../lib/utils.js';
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

  static refusals(value: unknown) {
    const relation = isObject(value) ? value.relation : undefined;
    if (!isObject(relation) || !('to' in relation) || typeof relation.to === 'function') return [];

    return [{ path: ['role', 'relation', 'to'], message: 'Expected a function returning the target entity, such as () => Post' }];
  }

  private constructor(private readonly rules: RoleRules = {}) {}

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
