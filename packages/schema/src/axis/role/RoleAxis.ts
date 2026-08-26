import type { Axis, Resolver } from '../Axis.js';
import { refuse } from '../../card/admission.js';
import { isObject, oneOfTokens } from '../../judge/ValueForm.js';
import type { ValidationError } from '../../judge/result.js';
import { ON_DELETE, RELATION_KINDS, type EntityConstructor, type Relation } from './Relation.js';
import { type RoleRules } from './Role.js';
import { FieldGroup } from '../../constraint/FieldGroup.js';
import { Unique } from '../../constraint/Unique.js';
import type { RoleDescriptor } from '../../card/Descriptor.js';
import { lowerFirst } from '../../utils.js';

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
        to: lowerFirst(target.name ?? ''),
        kind: role.relation.kind,
        ...(role.relation.onDelete ? { onDelete: role.relation.onDelete } : {}),
      };
    }
    return Object.keys(out).length ? out : undefined;
  },

  reconstruct(wire, resolve?: Resolver) {
    const out: RoleRules = {};
    if (wire.primary) out.primary = true;
    if (wire.unique?.length) out.rules = wire.unique.map((group) => new Unique(group));
    if (wire.index) out.index = true;
    if (wire.relation) {
      // `judge` cannot serve here: it demands a thunk where a card carries a name.
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
      out.relation = {
        to: () => (resolve?.(name) ?? ({ name } as unknown)) as EntityConstructor,
        kind: wire.relation.kind as Relation['kind'],
        ...(wire.relation.onDelete ? { onDelete: wire.relation.onDelete as Relation['onDelete'] } : {}),
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

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
