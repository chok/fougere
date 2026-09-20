import type { EntityConstructor } from '../../axis/role/EntityConstructor.js';
import type { Relation } from '../../axis/role/Relation.js';
import type { RoleRules } from '../../axis/role/Role.js';
import type { Resolver } from '../../axis/Resolver.js';
import { lowerFirst } from '../../lib/utils.js';
import type { CardForm } from './CardForm.js';

/**
 * What a role becomes on a card: a target is a NAME there, and `unique` and `index` are both
 * GROUPS — the field says `true`, the card says which names go together, since a group of
 * several belongs to no single field.
 */
export type RoleDescriptor = Pick<RoleRules, 'primary'> & {
  unique?: string[][];
  index?: string[][];
  relation?: RelationDescriptor;
};

export type RelationDescriptor = Pick<Relation, 'kind' | 'onDelete'> & { to: string };

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** A card carries the target's NAME: a class cannot cross a process boundary. */
export const roleOnCard: CardForm<RoleRules, RoleDescriptor> = {
  describe(role, key) {
    const descriptor: Mutable<RoleDescriptor> = {};
    if (role.primary) descriptor.primary = true;
    if (role.unique) descriptor.unique = [[key]];
    if (role.index) descriptor.index = [[key]];
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
    const rules: Mutable<RoleRules> = {};
    if (wire.primary) rules.primary = true;
    if (wire.unique?.some((group) => group.length === 1)) rules.unique = true;
    if (wire.index?.some((group) => group.length === 1)) rules.index = true;
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
