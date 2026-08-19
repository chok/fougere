import type { Axis, Resolver } from '../Axis.js';
import { isObject, oneOfTokens } from '../../judge/form.js';
import type { ValidationError } from '../../judge/result.js';
import { ON_DELETE, RELATION_KINDS, type EntityConstructor } from './Relation.js';
import { type RoleRules } from './Role.js';
import { FieldGroup } from '../../constraint/FieldGroup.js';
import { Unique } from '../../constraint/Unique.js';
import type { RoleDescriptor } from '../../card/Descriptor.js';
import { registrationKeyOf } from '../../name.js';

/**
 * Identity and relations — the axis the storage realizes. It is the only one of the three
 * whose projections are not the identity, because two of its members cannot travel as they
 * are held: a group's members are implicit in memory, and a relation's target is a thunk.
 */
export const roleAxis: Axis<RoleRules, RoleDescriptor> = {
  slot: 'role',

  judge(value, errors) {
    if (!isObject(value)) {
      errors.push({ path: 'role', message: `Expected an object — got ${JSON.stringify(value)}` });
      return;
    }
    for (const flag of ['primary', 'index'] as const) {
      if (value[flag] !== undefined && typeof value[flag] !== 'boolean') {
        errors.push({
          path: `role.${flag}`,
          message: `Expected a boolean — got ${JSON.stringify(value[flag])}`,
        });
      }
    }
    if (value.rules !== undefined) {
      // By FORM: a built group, or the plain member list one denotes — the door normalizes
      // the second into the first, so a card or a config is judged like anything else.
      const legal =
        Array.isArray(value.rules) &&
        value.rules.every(
          (rule) =>
            rule instanceof FieldGroup ||
            (Array.isArray(rule) && rule.every((member) => typeof member === 'string')),
        );
      if (!legal) {
        errors.push({
          path: 'role.rules',
          message: 'Expected field groups, or the member lists they denote — string[][]',
        });
      }
    }
    if (value.relation !== undefined) judgeRelation(value.relation, errors);
  },

  describe(role, key) {
    const out: Mutable<RoleDescriptor> = {};
    if (role.primary) out.primary = true;
    const unique = (role.rules ?? []).filter((rule) => rule instanceof Unique);
    if (unique.length) out.unique = unique.map((rule) => [...rule.resolvedOn(key).members]);
    if (role.index) out.index = true;
    if (role.relation) {
      const target = role.relation.to() as { name?: string };
      out.relation = {
        // The thunk hands back the class; the card carries its registration key, the one
        // name every projection agrees on.
        to: registrationKeyOf(target.name ?? ''),
        kind: role.relation.kind,
        ...(role.relation.onDelete ? { onDelete: role.relation.onDelete } : {}),
      };
    }
    return Object.keys(out).length ? out : undefined;
  },

  reconstruct(wire, resolve?: Resolver) {
    const out: RoleRules = {};
    if (wire.primary) out.primary = true;
    // Members arrive spelled out and stay that way — reading a single-member group back as
    // the empty self-reference would re-describe identically and lose the distinction.
    if (wire.unique?.length) out.rules = wire.unique.map((group) => Unique.of(...group));
    if (wire.index) out.index = true;
    if (wire.relation) {
      const name = wire.relation.to;
      out.relation = {
        // Lazy, so a circular relation resolves. Without a resolver (a lone card), a
        // name-only stand-in: enough to validate and re-describe, not to feed an adapter.
        to: () => (resolve?.(name) ?? ({ name } as unknown)) as EntityConstructor,
        kind: wire.relation.kind as RoleRules['relation'] extends infer R ? never : never extends never ? 'one' | 'many' : never,
        ...(wire.relation.onDelete ? { onDelete: wire.relation.onDelete as 'cascade' } : {}),
      } as RoleRules['relation'];
    }
    return out;
  },
};

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
  // A thunk, never the class: it is what lets a circular relation resolve lazily.
  if (typeof relation.to !== 'function') {
    errors.push({ path: 'role.relation.to', message: 'Expected a thunk returning the target entity' });
  }
  if (relation.onDelete !== undefined && !oneOfTokens(relation.onDelete, ON_DELETE)) {
    errors.push({
      path: 'role.relation.onDelete',
      message: `Expected 'cascade', 'restrict' or 'set null' — got ${JSON.stringify(relation.onDelete)}`,
    });
  }
}

/** The descriptor is read-only for consumers; the axis is the one place that BUILDS it. */
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
