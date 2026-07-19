import type { AnyField, Fields, Shape } from '../field/index.js';
import { anatomy, boundaryOf, resolveBoundary } from '../field/index.js';
import { Validator } from '@cfworker/json-schema';

/**
 * Validation — the Field metadata IS the source of truth.
 *
 * Validation is a projection of one axis: `shape` (the value), a PURE predicate —
 * it answers "is this value valid?" and never mutates the value. Null included:
 * the shape's `[T,'null']` union is judged by the engine, there is no hand-rolled
 * null branch. It never looks at `role` (persistence/domain) — a foreign key is
 * just a string here. Converting a valid value (e.g. an ISO string → a `Date`)
 * is a separate step, the `boundary` axis, applied after the predicate passes.
 * Absence is judged by `lifecycle.create` — any create rule makes it legal and
 * the field is OMITTED from the result, never filled: realising the rule
 * (stamp 'now', apply { value }, generate) belongs to the storage adapter at
 * the point of persistence, whose insert returns the complete row.
 */

export interface ValidationError {
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] };

type Checked = { value: unknown } | { error: string };

/**
 * One validator per shape — the shape object IS the source JSON Schema (the closed
 * grammar the helpers emit), handed straight to the engine. Keyed by the shape
 * reference (stable: derivations copy field refs, `partial()` spreads the field but
 * keeps the same `shape`), built once and reused so the parse cost is amortised.
 */
const validators = new WeakMap<object, Validator>();

function validatorFor(shape: Shape): Validator {
  let v = validators.get(shape);
  if (!v) {
    v = new Validator(shape as object, '2020-12', true);
    validators.set(shape, v);
  }
  return v;
}

/** Validate a present value (null included) against its field — pure, never mutates. */
function checkValue(field: AnyField, value: unknown): Checked {
  const shape = field.shape;
  // Relation-only field (`many`): no value shape, just an array of related rows.
  if (!shape) {
    if (field.role?.relation?.kind === 'many') {
      return Array.isArray(value) ? { value } : { error: 'Expected an array' };
    }
    return { value };
  }
  // The pre-engine guards dispatch on the BASE type — `shape.type` itself may be
  // the nullable union. They only short-circuit NON-null values: null always goes
  // to the engine, whose union judges it (that is the whole nullability model).
  const base = anatomy(shape).base;
  if (value !== null) {
    // Opaque JSON (`json()`): no nested shape → passes through unchecked.
    // `json(Entity)` carries `properties` and falls through to the engine,
    // which validates the nesting natively (it's plain JSON Schema).
    if (base?.type === 'object' && !base.properties) return { value };
    // A date-time field also accepts a live Date — the domain value, not its JSON wire
    // string — which the boundary then passes through. The engine validates JSON, so a
    // Date (a non-JSON value) skips the schema check here; a date STRING is validated below.
    if (base?.type === 'string' && base.format === 'date-time' && value instanceof Date) {
      return Number.isNaN(value.getTime()) ? { error: 'Invalid date' } : { value };
    }
    // NaN is `typeof number` yet has no JSON form, so the JSON-centric engine accepts it —
    // guard it here (same nature as the Date case: a JS value JSON can't represent).
    if ((base?.type === 'number' || base?.type === 'integer') && typeof value === 'number' && Number.isNaN(value)) {
      return { error: 'Expected a number' };
    }
  }
  const result = validatorFor(shape).validate(value);
  return result.valid ? { value } : { error: result.errors[0]?.error ?? 'Invalid value' };
}

export interface ValidateOptions {
  /**
   * Patch mode (update). An absent field is OMITTED from the result — not filled,
   * not required — so `validate({ name })` touches only `name`. Set by `partial()`.
   * Distinguishes "absent → don't touch" (patch) from "absent → null" (create).
   */
  patch?: boolean;
}

export function validateFields(
  fields: Fields,
  input: unknown,
  pathPrefix = '',
  opts: ValidateOptions = {},
): ValidationResult<Record<string, unknown>> {
  if (typeof input !== 'object' || input === null) {
    return { success: false, errors: [{ path: pathPrefix || '.', message: 'Expected an object' }] };
  }

  const data = input as Record<string, unknown>;
  const errors: ValidationError[] = [];
  const out: Record<string, unknown> = {};

  // Refuse, never strip: a key outside the contract is an error, not a silent
  // drop. The client derives from the same contract (a form cannot emit a
  // foreign key), so a stranger is a bug or an attack — both deserve the 400.
  // Stripping would also let the envelope diverge from GraphQL, which refuses
  // unknown input keys by construction.
  for (const key of Object.keys(data)) {
    if (!(key in fields)) {
      errors.push({ path: pathPrefix ? `${pathPrefix}.${key}` : key, message: 'Unknown field' });
    }
  }

  for (const [key, field] of Object.entries(fields)) {
    const path = pathPrefix ? `${pathPrefix}.${key}` : key;
    const value = data[key];

    if (value === undefined) {
      if (opts.patch) continue; // patch: an unsent field is left untouched
      // A read-only field is server-owned: its absence from a client input is
      // never "Required" (same stance as OpenAPI readOnly+required).
      if (boundaryOf(field).in === 'closed') continue;
      // Absence is answered by `lifecycle.create` — a key access on the normal
      // form. The judge only asks "is there a rule?": any rule ('now',
      // 'optional', { value }, { generate }) makes absence legal, and the field
      // is omitted from the result. Realisation is the storage adapter's role.
      if (field.lifecycle?.create !== undefined) continue;
      // No create rule: a `many` relation defaults to the empty collection
      // (graph semantics, read on `role` — never a shared `{ value: [] }`).
      if (field.role?.relation?.kind === 'many') { out[key] = []; continue; }
      errors.push({ path, message: 'Required' });
      continue;
    }

    // A PRESENT value can be illegal by an axis other than shape:
    // boundary `in: 'closed'` — a read-only field never crosses inbound;
    // lifecycle `update: 'forbidden'` — re-supplying an immutable field in a patch.
    if (boundaryOf(field).in === 'closed') {
      errors.push({ path, message: 'Read-only' });
      continue;
    }
    if (opts.patch && field.lifecycle?.update === 'forbidden') {
      errors.push({ path, message: 'Immutable' });
      continue;
    }

    // The shape predicate judges the value — null included, via the `[T,'null']`
    // union. Then the boundary's decode converts wire→domain; null skips decode
    // (a legal null is already the domain value, there is nothing to convert).
    const checked = checkValue(field, value);
    if ('error' in checked) {
      errors.push({ path, message: checked.error });
      continue;
    }
    if (checked.value === null) {
      out[key] = null;
      continue;
    }
    const decoded = resolveBoundary(field).decode(checked.value);
    if ('error' in decoded) errors.push({ path, message: decoded.error });
    else out[key] = decoded.value;
  }

  if (errors.length > 0) return { success: false, errors };
  return { success: true, data: out };
}
