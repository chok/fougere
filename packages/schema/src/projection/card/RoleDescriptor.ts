import type { Entity } from '../../entity/Entity.js';
import { ON_DELETE, RELATION_KINDS } from '../../axis/role/Relation.js';
import type { RoleRules } from '../../axis/role/Role.js';
import type { Resolver } from '../../axis/Resolver.js';
import { Format, type Accepted } from '../../lib/Format.js';
import { lowerFirst } from '../../lib/utils.js';
import type { CardForm } from './CardForm.js';

const GROUPS = Format.listOf(Format.listOf(Format.text));

/**
 * What a role becomes on a card: a target is a NAME there, and `unique` and `index` are both
 * GROUPS — the field says `true`, the card says which names go together, since a group of
 * several belongs to no single field.
 */
const ROLE_ON_CARD = Format.of('card/role')
  .key('primary', Format.flag)
  .key('unique', GROUPS)
  .key('index', GROUPS)
  .key(
    'relation',
    Format.of()
      .key('to', Format.text)
      .key('kind', Format.tokens(RELATION_KINDS))
      .key('onDelete', Format.tokens(ON_DELETE))
      .needs('to', 'kind')
      .closed(),
  )
  .closed();

export type RoleDescriptor = Accepted<typeof ROLE_ON_CARD>;

export type RelationDescriptor = NonNullable<RoleDescriptor['relation']>;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** A card carries the target's NAME: a class cannot cross a process boundary. */
export const roleOnCard: CardForm<RoleRules, RoleDescriptor> = {
  format: ROLE_ON_CARD,

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
        to: () => (resolve?.(name) ?? ({ name } as unknown)) as Entity,
        kind: wire.relation.kind,
        ...(wire.relation.onDelete ? { onDelete: wire.relation.onDelete } : {}),
      };
    }

    return rules;
  },
};
