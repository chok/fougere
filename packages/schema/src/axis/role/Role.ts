import type { Relation } from './Relation.js';
import type { EntityConstructor } from './EntityConstructor.js';
import type { Axis } from '../Axis.js';
import type { Resolver } from '../Resolver.js';
import { isObject, lowerFirst } from '../../lib/utils.js';
import { Format } from '../../lib/Format.js';
import { ON_DELETE, RELATION_KINDS } from './Relation.js';
import type { RoleDescriptor } from '../../projection/card/RoleDescriptor.js';

export interface RoleRules {
  primary?: boolean;
  index?: boolean;
  unique?: boolean;
  relation?: Relation;
}

export const roleAxis: Axis<RoleRules, RoleDescriptor> = {
  slot: 'role',

  format: Format.of('axis/role')
    .key('primary', Format.flag)
    .key('index', Format.flag)
    .key('unique', Format.flag)
    .key(
      'relation',
      Format.of()
        .key('to', Format.anything)
        .key('kind', Format.tokens(RELATION_KINDS))
        .key('onDelete', Format.tokens(ON_DELETE))
        .needs('kind')
        .closed(),
    )
    .closed(),

  refusals(value) {
    const relation = isObject(value) ? value.relation : undefined;
    if (!isObject(relation) || typeof relation.to === 'function') return [];

    return [{ path: ['role', 'relation', 'to'], message: 'Expected a function returning the target entity, such as () => Post' }];
  },

  /** A card carries the target's NAME: a class cannot cross a process boundary. */
  describe(role, key) {
    const descriptor: Mutable<RoleDescriptor> = {};
    if (role.primary) descriptor.primary = true;
    if (role.unique) descriptor.unique = [[key]];
    if (role.index) descriptor.index = true;
    if (role.relation) {
      const target = role.relation.to() as { name?: string };
      descriptor.relation = {
        to: lowerFirst(target.name ?? ''),
        kind: role.relation.kind,
        ...(role.relation.onDelete ? { onDelete: role.relation.onDelete } : {}),
      };
    }
    return Object.keys(descriptor).length ? descriptor : undefined;
  },

  reconstruct(wire, resolve?: Resolver) {
    const rules: RoleRules = {};
    if (wire.primary) rules.primary = true;
    if (wire.unique?.some((group) => group.length === 1)) rules.unique = true;
    if (wire.index) rules.index = true;
    if (wire.relation) {
      const name = wire.relation.to;
      rules.relation = {
        to: () => (resolve?.(name) ?? ({ name } as unknown)) as EntityConstructor,
        kind: wire.relation.kind,
        ...(wire.relation.onDelete ? { onDelete: wire.relation.onDelete } : {}),
      };
    }
    return rules;
  },
};

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export class Role {
  private readonly primary?: boolean;
  private readonly index?: boolean;
  private readonly unique?: boolean;
  private readonly relation?: Relation;

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

  /** Either kind — what a CLI flag and a GraphQL selection both leave out. */
  get isRelation(): boolean {
    return this.relation !== undefined;
  }

  /** Calls `() => Post` so no caller has to. */
  get target(): EntityConstructor | undefined {
    return this.relation?.to();
  }

  get onDelete(): Relation['onDelete'] {
    return this.relation?.onDelete;
  }
}
