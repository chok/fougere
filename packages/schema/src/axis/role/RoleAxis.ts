import type { Axis, Resolver } from '../Axis.js';
import { refuse, oneOfTokens } from '../../projection/card/admission.js';
import { isObject, lowerFirst } from '../../lib/utils.js';
import type { ValidationError } from '../../result.js';
import { ON_DELETE, RELATION_KINDS, type EntityConstructor, type Relation } from './Relation.js';
import { type RoleRules } from './Role.js';
import type { RoleDescriptor } from '../../projection/card/Descriptor.js';

export const roleAxis: Axis<RoleRules, RoleDescriptor> = {
  slot: 'role',

  judge(value, errors) {
    if (!isObject(value)) {
      errors.push({ path: 'role', message: `Expected an object — got ${JSON.stringify(value)}` });
      return;
    }
    for (const flag of ['primary', 'index', 'unique'] as const) {
      if (value[flag] !== undefined && typeof value[flag] !== 'boolean') {
        errors.push({
          path: `role.${flag}`,
          message: `Expected a boolean — got ${JSON.stringify(value[flag])}`,
        });
      }
    }
    if (value.relation !== undefined) judgeRelation(value.relation, errors);
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
      // `judge` cannot serve here: it demands `() => Post` where a card carries a name.
      if (!oneOfTokens(wire.relation.kind, RELATION_KINDS)) {
        refuse(
          `role.relation.kind is ${JSON.stringify(wire.relation.kind)}`,
          `Expected one of ${RELATION_KINDS.join(', ')}.`,
        );
      }
      if (wire.relation.onDelete !== undefined && !oneOfTokens(wire.relation.onDelete, ON_DELETE)) {
        refuse(
          `role.relation.onDelete is ${JSON.stringify(wire.relation.onDelete)}`,
          `Expected one of ${ON_DELETE.join(', ')}.`,
        );
      }
      const name = wire.relation.to;
      rules.relation = {
        to: () => (resolve?.(name) ?? ({ name } as unknown)) as EntityConstructor,
        kind: wire.relation.kind as Relation['kind'],
        ...(wire.relation.onDelete ? { onDelete: wire.relation.onDelete as Relation['onDelete'] } : {}),
      } as RoleRules['relation'];
    }
    return rules;
  },
};

/**
 * So a relation is judged where `() => Post` is required — a card carries a name.
 * FR : pour qu'une relation soit jugée là où `() => Post` est exigé, contrairement à une carte.
 * `{ to: User, kind: 'one' }` → error `Expected a function returning the target entity, such as () => Post`
 */
function judgeRelation(relation: unknown, errors: ValidationError[]): void {
  if (!isObject(relation)) {
    errors.push({ path: 'role.relation', message: `Expected an object — got ${JSON.stringify(relation)}` });
    return;
  }
  if (!oneOfTokens(relation.kind, RELATION_KINDS)) {
    errors.push({
      path: 'role.relation.kind',
      message: `Expected 'one' or 'many' — got ${JSON.stringify(relation.kind)}`,
    });
  }
  if (typeof relation.to !== 'function') {
    errors.push({ path: 'role.relation.to', message: 'Expected a function returning the target entity, such as () => Post' });
  }
  if (relation.onDelete !== undefined && !oneOfTokens(relation.onDelete, ON_DELETE)) {
    errors.push({
      path: 'role.relation.onDelete',
      message: `Expected 'cascade', 'restrict' or 'set null' — got ${JSON.stringify(relation.onDelete)}`,
    });
  }
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
