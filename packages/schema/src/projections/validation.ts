import type { Field, Fields, FormatPredicate, Shape } from '../field/index.js';
import { anatomy, boundaryOf, resolveBoundary, resolveFormat } from '../field/index.js';
import { Validator, format as engineFormats } from '@cfworker/json-schema';

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

export type Checked = { value: unknown } | { error: string };

/**
 * What judging one shape takes: the engine's validator, plus the custom format
 * predicate the engine does NOT know about (see {@link customFormatOf}).
 */
interface ShapePlan {
  validator: Validator;
  /** Runs in ADDITION to the engine's verdict — never instead of it. */
  custom?: FormatPredicate;
  /** The declared format name, kept for the error message. */
  formatName?: string;
}

/**
 * One plan per shape — the shape object IS the source JSON Schema (the closed
 * grammar the helpers emit), handed straight to the engine. Keyed by the shape
 * reference (stable: derivations copy field refs, `partial()` spreads the field but
 * keeps the same `shape`), built once and reused so the parse cost is amortised —
 * and so an unresolvable format is refused once per shape, never per value.
 */
const plans = new WeakMap<object, ShapePlan>();

function planFor(shape: Shape): ShapePlan {
  let p = plans.get(shape);
  if (!p) {
    const base = anatomy(shape).base;
    const formatName = base?.type === 'string' ? base.format : undefined;
    p = {
      validator: new Validator(shape as object, '2020-12', true),
      custom: formatName === undefined ? undefined : customFormatOf(formatName),
      formatName,
    };
    plans.set(shape, p);
  }
  return p;
}

/**
 * Resolve a declared format against the engine's built-ins and our registry, and
 * REFUSE a name neither knows.
 *
 * The engine ignores an unknown format in silence — `format[$format] && …`, so a
 * typo or a predicate nobody registered would let every value through while the
 * card claims the field is constrained. That is the exact loss this repo refuses
 * elsewhere: an unregistered boundary codec throws for the same reason, on the
 * same grounds ("loud and late beats silent and never").
 *
 * Returns the custom predicate, or undefined when the engine already judges the
 * name. Both may exist — then both run.
 *
 * SCOPE: the field's own shape. A format nested inside `json(Entity)` is not
 * reached, the same boundary as the nested-path limit documented on validation.
 */
function customFormatOf(name: string): FormatPredicate | undefined {
  const custom = resolveFormat(name);
  if (!custom && !(name in engineFormats)) {
    throw new Error(
      `Unknown format: '${name}'. Register it with registerFormat('${name}', …) — ` +
        `the engine judges ${Object.keys(engineFormats).length} formats natively and this is not one of them.`,
    );
  }
  return custom;
}

/**
 * Validate a present value (null included) against its field — pure, never mutates.
 *
 * Reads `shape` and nothing else, so it answers "is this a legal value?" without ever
 * asking who is speaking. That is what makes it usable on the way OUT of the domain,
 * where the client-only axes (`boundary`, `lifecycle`) do not apply.
 */
export function checkValue(field: Field, value: unknown): Checked {
  const shape = field.shape;
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
  const plan = planFor(shape);
  const result = plan.validator.validate(value);
  if (!result.valid) return { error: result.errors[0]?.error ?? 'Invalid value' };
  // A registered format judges AFTER the engine passed — so a custom rule composes
  // with the built-ins instead of replacing them, and the message is the engine's
  // own wording: from the outside, `siret` fails exactly like `email` does.
  if (plan.custom && typeof value === 'string' && !plan.custom(value)) {
    return { error: `String does not match format "${plan.formatName}".` };
  }
  return { value };
}

export interface ValidateOptions {
  /**
   * Patch mode (update). An absent field is OMITTED from the result — not filled,
   * not required — so `validate({ name })` touches only `name`. Set by `partial()`.
   * Distinguishes "absent → don't touch" (patch) from "absent → null" (create).
   */
  patch?: boolean;
}

/**
 * A path is a field NAME here, never a dotted trail: `json(Entity)` is judged as one
 * opaque shape by the engine, so a nested failure answers `{ path: 'addr' }` with the
 * inner field in the prose. This used to take a `pathPrefix` that every call site passed
 * as `''` — a parameter for a recursion nobody wrote, which made the code read as if
 * nesting were handled. Writing that recursion changes what `FougereError.details`
 * carries across processes and languages, so it is a contract decision, not a patch.
 */
export function validateFields(
  fields: Fields,
  input: unknown,
  opts: ValidateOptions = {},
): ValidationResult<Record<string, unknown>> {
  if (typeof input !== 'object' || input === null) {
    return { success: false, errors: [{ path: '.', message: 'Expected an object' }] };
  }

  const data = input as Record<string, unknown>;
  const errors: ValidationError[] = [];
  const out: Record<string, unknown> = {};

  // Refuse, never strip: a key outside the contract is an error, not a silent
  // drop. The client derives from the same contract (a form cannot emit a
  // foreign key), so a stranger is a bug or an attack — both deserve the 400.
  // Stripping would also let the envelope diverge from GraphQL, which refuses
  // unknown input keys by construction.
  //
  // A FACT is judged by this same rule, deliberately — the one place it was tempting to
  // relax it. A subscriber's copy of a fact can be older than the sender's, so tolerating
  // a stranger key would let a rolling deployment through; it would also mean a reader
  // silently ignoring a field it was supposed to handle. If the judge refuses, that is
  // the end of it: the sender re-syncs its readers before it ships.
  for (const key of Object.keys(data)) {
    if (!(key in fields)) {
      errors.push({ path: key, message: 'Unknown field' });
    }
  }

  for (const [key, field] of Object.entries(fields)) {
    const path = key;
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
