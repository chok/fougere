import type { Relation } from './Relation.js';
import type { EntityConstructor } from './EntityConstructor.js';
import type { Resolver } from '../Resolver.js';
import { isObject, lowerFirst } from '../../lib/utils.js';
import { Format, type Accepted } from '../../lib/Format.js';
import { ON_DELETE, RELATION_KINDS } from './Relation.js';
import type { RoleDescriptor } from '../../projection/card/RoleDescriptor.js';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

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

  /** A card carries the target's NAME: a class cannot cross a process boundary. */
  static describe(role: RoleRules, key: string): RoleDescriptor | undefined {
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
  }

  static reconstruct(wire: RoleDescriptor, resolve?: Resolver): RoleRules {
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
