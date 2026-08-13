import { isShape } from './shape.js';
import type { Field } from './field.js';

/**
 * Judge a field's own declaration — the five axes, each against its closed vocabulary.
 *
 * Same answer shape as `Entity.validate`: a list of `{ path, message }`, because "is this
 * a field" and "is this a legal value" are the same question asked of different data, and
 * a boolean says no without saying where. `{ shape: {}, lifecycle: 'nawak' }` used to build
 * a field that judged nothing and silently made a required key optional.
 *
 * `role.relation.to` is a FUNCTION, so no schema can describe a live field and this is
 * written by hand. The card's `FieldDescriptor` is pure JSON and is the half a schema
 * could one day judge.
 */

export interface FieldError {
  /** The axis, dotted to the offending member — `lifecycle.create`, `role.relation.kind`. */
  path: string;
  message: string;
}

export type FieldVerdict = { success: true } | { success: false; errors: FieldError[] };

const CREATE_TOKENS = ['now', 'optional'] as const;
const UPDATE_TOKENS = ['now', 'forbidden'] as const;
const RELATION_KINDS = ['one', 'many'] as const;
const ON_DELETE = ['cascade', 'restrict', 'set null'] as const;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const oneOfTokens = (v: unknown, tokens: readonly string[]) =>
  typeof v === 'string' && tokens.includes(v);

/** `'now' | 'optional' | { value } | { generate: <name> }` — the four ways absence is answered. */
function checkCreate(rule: unknown, errors: FieldError[]): void {
  if (oneOfTokens(rule, CREATE_TOKENS)) return;
  if (isObject(rule)) {
    if ('value' in rule) return; // any value — the shape judges it (`assertDefaultsAreValid`)
    if ('generate' in rule) {
      if (typeof rule.generate !== 'string') {
        errors.push({ path: 'lifecycle.create.generate', message: 'Expected a generator name' });
      }
      return;
    }
  }
  errors.push({
    path: 'lifecycle.create',
    message: `Expected 'now', 'optional', { value } or { generate } — got ${JSON.stringify(rule)}`,
  });
}

function checkLifecycle(lifecycle: unknown, errors: FieldError[]): void {
  if (!isObject(lifecycle)) {
    errors.push({ path: 'lifecycle', message: `Expected an object — got ${JSON.stringify(lifecycle)}` });
    return;
  }
  if (lifecycle.create !== undefined) checkCreate(lifecycle.create, errors);
  if (lifecycle.update !== undefined && !oneOfTokens(lifecycle.update, UPDATE_TOKENS)) {
    errors.push({
      path: 'lifecycle.update',
      message: `Expected 'now' or 'forbidden' — got ${JSON.stringify(lifecycle.update)}`,
    });
  }
}

function checkRelation(relation: unknown, errors: FieldError[]): void {
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

function checkRole(role: unknown, errors: FieldError[]): void {
  if (!isObject(role)) {
    errors.push({ path: 'role', message: `Expected an object — got ${JSON.stringify(role)}` });
    return;
  }
  for (const flag of ['primary', 'index'] as const) {
    if (role[flag] !== undefined && typeof role[flag] !== 'boolean') {
      errors.push({ path: `role.${flag}`, message: `Expected a boolean — got ${JSON.stringify(role[flag])}` });
    }
  }
  if (role.unique !== undefined) {
    const groups = role.unique;
    const legal =
      Array.isArray(groups) &&
      groups.every((g) => Array.isArray(g) && g.every((m) => typeof m === 'string'));
    if (!legal) {
      errors.push({ path: 'role.unique', message: 'Expected groups of field names — string[][]' });
    }
  }
  if (role.relation !== undefined) checkRelation(role.relation, errors);
}

/**
 * The registry is OPEN, so a name cannot be checked here — `declaredBoundary` resolves it
 * and throws `Unknown boundary alias` at the one place that can know. Only the FORM is
 * judged: a name, or a pair of directional rules.
 */
function checkBoundary(boundary: unknown, errors: FieldError[]): void {
  if (typeof boundary === 'string') return;
  if (!isObject(boundary)) {
    errors.push({ path: 'boundary', message: `Expected an alias name or { in, out } — got ${JSON.stringify(boundary)}` });
    return;
  }
  for (const [side, verb] of [['in', 'decode'], ['out', 'encode']] as const) {
    const rule = boundary[side];
    if (rule === undefined || rule === 'closed') continue;
    if (!isObject(rule) || typeof rule[verb] !== 'string') {
      errors.push({ path: `boundary.${side}`, message: `Expected 'closed' or { ${verb}: <name> }` });
    }
  }
}

/** Judge a field declaration. `success` alone is {@link isField}; the errors say where. */
export function validateField(value: unknown): FieldVerdict {
  if (!isObject(value)) {
    return { success: false, errors: [{ path: '.', message: `Expected an object — got ${JSON.stringify(value)}` }] };
  }
  const errors: FieldError[] = [];

  if (!isShape(value.shape)) {
    errors.push({
      path: 'shape',
      message: `Every field states a shape — got ${JSON.stringify(value.shape)}`,
    });
  }
  if (value.lifecycle !== undefined) checkLifecycle(value.lifecycle, errors);
  if (value.role !== undefined) checkRole(value.role, errors);
  if (value.boundary !== undefined) checkBoundary(value.boundary, errors);
  if (value.meta !== undefined) {
    if (!isObject(value.meta)) {
      errors.push({ path: 'meta', message: `Expected an object — got ${JSON.stringify(value.meta)}` });
    } else if (value.meta.description !== undefined && typeof value.meta.description !== 'string') {
      errors.push({ path: 'meta.description', message: 'Expected a string' });
    }
  }

  return errors.length ? { success: false, errors } : { success: true };
}

/** The same judgment, as a guard — for a caller that only needs the verdict. */
export function isField(value: unknown): value is Field {
  return validateField(value).success;
}
