import type { Field, FormatPredicate, Shape } from '../field/index.js';
import { anatomy, resolveFormat } from '../field/index.js';
import { Validator, format as engineFormats } from '@cfworker/json-schema';

/**
 * Judging ONE value against its shape — a pure predicate, and the only axis it reads.
 * Null included: the `[T,'null']` union is judged by the engine, there is no hand-rolled
 * null branch. Usable on the way OUT of the domain, where `boundary` and `lifecycle` —
 * the client-only axes — do not apply.
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
