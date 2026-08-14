import type { Field, Fields, FormatPredicate, Shape } from '../field/index.js';
import { CREATE_TOKENS, UPDATE_TOKENS } from '../field/lifecycle.js';
import { ON_DELETE, RELATION_KINDS } from '../field/role.js';
import { Anatomy, Formats, boundaryOf, isShape, resolveBoundary, } from '../field/index.js';
import { Validator, format as engineFormats } from '@cfworker/json-schema';
import type { Checked, ValidationError, ValidationResult } from './result.js';

interface ShapePlan {
  validator: Validator;
  /** Runs in ADDITION to the engine's verdict — never instead of it. */
  custom?: FormatPredicate;
  /** The declared format name, kept for the error message. */
  formatName?: string;
}

/** Patch mode: an unsent field is untouched. Distinguishes "absent, don't touch" from "absent → null". */
export interface ValidateOptions {
  patch?: boolean;
}


const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const oneOfTokens = (v: unknown, tokens: readonly string[]) =>
  typeof v === 'string' && tokens.includes(v);

/**
 * The one judge, at the three levels anything is judged: a field's DECLARATION, one VALUE
 * against its shape, a ROW against a field map. Same answer shape at all three.
 *
 * A class and not three functions because it holds state: the per-shape plan cache. The
 * closed vocabularies belong to the axes that close them — this file imports them.
 */
export class Judge {
  /**
   * One plan per shape — the shape object IS the source JSON Schema (the closed
   * grammar the helpers emit), handed straight to the engine. Keyed by the shape
   * reference (stable: derivations copy field refs, `partial()` spreads the field but
   * keeps the same `shape`), built once and reused so the parse cost is amortised —
   * and so an unresolvable format is refused once per shape, never per value.
   */
  private static readonly plans = new WeakMap<object, ShapePlan>();

  private static planFor(shape: Shape): ShapePlan {
    let p = this.plans.get(shape);
    if (!p) {
      const base = Anatomy.of(shape).base;
      const formatName = base?.type === 'string' ? base.format : undefined;
      p = {
        validator: new Validator(shape as object, '2020-12', true),
        custom: formatName === undefined ? undefined : this.customFormatOf(formatName),
        formatName,
      };
      this.plans.set(shape, p);
    }
    return p;
  }

  /**
   * Resolve a declared format, and REFUSE a name neither the engine nor the registry
   * knows: the engine ignores an unknown format in silence, so a typo would let every
   * value through while the card claims the field is constrained.
   *
   * SCOPE: the field's own shape — a format nested inside `json(Entity)` is not reached.
   */
  private static customFormatOf(name: string): FormatPredicate | undefined {
    const custom = Formats.resolve(name);
    if (!custom && !(name in engineFormats)) {
      throw new Error(
        `Unknown format: '${name}'. Register it with Formats.register('${name}', …) — ` +
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

  static value(field: Field, value: unknown): Checked {
    const shape = field.shape;
    // The pre-engine guards dispatch on the BASE type — `shape.type` itself may be
    // the nullable union. They only short-circuit NON-null values: null always goes
    // to the engine, whose union judges it (that is the whole nullability model).
    const base = Anatomy.of(shape).base;
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
    const plan = this.planFor(shape);
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

  /** `'now' | 'optional' | { value } | { generate: <name> }` — the four ways absence is answered. */
  private static checkCreate(rule: unknown, errors: ValidationError[]): void {
    if (oneOfTokens(rule, CREATE_TOKENS)) return;
    if (isObject(rule)) {
      if ("value" in rule) return; // any value — the shape judges it (`assertDefaultsAreValid`)
      if ("generate" in rule) {
        if (typeof rule.generate !== "string") {
          errors.push({
            path: "lifecycle.create.generate",
            message: "Expected a generator name",
          });
        }
        return;
      }
    }
    errors.push({
      path: "lifecycle.create",
      message: `Expected 'now', 'optional', { value } or { generate } — got ${JSON.stringify(rule)}`,
    });
  }

  private static checkLifecycle(lifecycle: unknown, errors: ValidationError[]): void {
    if (!isObject(lifecycle)) {
      errors.push({
        path: "lifecycle",
        message: `Expected an object — got ${JSON.stringify(lifecycle)}`,
      });
      return;
    }
    if (lifecycle.create !== undefined) this.checkCreate(lifecycle.create, errors);
    if (
      lifecycle.update !== undefined &&
      !oneOfTokens(lifecycle.update, UPDATE_TOKENS)
    ) {
      errors.push({
        path: "lifecycle.update",
        message: `Expected 'now' or 'forbidden' — got ${JSON.stringify(lifecycle.update)}`,
      });
    }
  }

  private static checkRelation(relation: unknown, errors: ValidationError[]): void {
    if (!isObject(relation)) {
      errors.push({
        path: "role.relation",
        message: `Expected an object — got ${JSON.stringify(relation)}`,
      });
      return;
    }
    if (!oneOfTokens(relation.kind, RELATION_KINDS)) {
      errors.push({
        path: "role.relation.kind",
        message: `Expected 'one' or 'many' — got ${JSON.stringify(relation.kind)}`,
      });
    }
    // A thunk, never the class: it is what lets a circular relation resolve lazily.
    if (typeof relation.to !== "function") {
      errors.push({
        path: "role.relation.to",
        message: "Expected a thunk returning the target entity",
      });
    }
    if (
      relation.onDelete !== undefined &&
      !oneOfTokens(relation.onDelete, ON_DELETE)
    ) {
      errors.push({
        path: "role.relation.onDelete",
        message: `Expected 'cascade', 'restrict' or 'set null' — got ${JSON.stringify(relation.onDelete)}`,
      });
    }
  }

  private static checkRole(role: unknown, errors: ValidationError[]): void {
    if (!isObject(role)) {
      errors.push({
        path: "role",
        message: `Expected an object — got ${JSON.stringify(role)}`,
      });
      return;
    }
    for (const flag of ["primary", "index"] as const) {
      if (role[flag] !== undefined && typeof role[flag] !== "boolean") {
        errors.push({
          path: `role.${flag}`,
          message: `Expected a boolean — got ${JSON.stringify(role[flag])}`,
        });
      }
    }
    if (role.unique !== undefined) {
      const groups = role.unique;
      const legal =
        Array.isArray(groups) &&
        groups.every(
          (g) => Array.isArray(g) && g.every((m) => typeof m === "string"),
        );
      if (!legal) {
        errors.push({
          path: "role.unique",
          message: "Expected groups of field names — string[][]",
        });
      }
    }
    if (role.relation !== undefined) this.checkRelation(role.relation, errors);
  }

  /**
   * The registry is OPEN, so a name cannot be checked here — `declaredBoundary` resolves it
   * and throws `Unknown boundary alias` at the one place that can know. Only the FORM is
   * judged: a name, or a pair of directional rules.
   */
  private static checkBoundary(boundary: unknown, errors: ValidationError[]): void {
    if (typeof boundary === "string") return;
    if (!isObject(boundary)) {
      errors.push({
        path: "boundary",
        message: `Expected an alias name or { in, out } — got ${JSON.stringify(boundary)}`,
      });
      return;
    }
    for (const [side, verb] of [
      ["in", "decode"],
      ["out", "encode"],
    ] as const) {
      const rule = boundary[side];
      if (rule === undefined || rule === "closed") continue;
      if (!isObject(rule) || typeof rule[verb] !== "string") {
        errors.push({
          path: `boundary.${side}`,
          message: `Expected 'closed' or { ${verb}: <name> }`,
        });
      }
    }
  }

  /** Judge a field's declaration — the five axes against their closed vocabularies. */

  static field(value: unknown): ValidationResult<Field> {
    if (!isObject(value)) {
      return {
        success: false,
        errors: [
          {
            path: ".",
            message: `Expected an object — got ${JSON.stringify(value)}`,
          },
        ],
      };
    }
    const errors: ValidationError[] = [];

    if (!isShape(value.shape)) {
      errors.push({
        path: "shape",
        message: `Every field states a shape — got ${JSON.stringify(value.shape)}`,
      });
    }
    if (value.lifecycle !== undefined) this.checkLifecycle(value.lifecycle, errors);
    if (value.role !== undefined) this.checkRole(value.role, errors);
    if (value.boundary !== undefined) this.checkBoundary(value.boundary, errors);
    if (value.meta !== undefined) {
      if (!isObject(value.meta)) {
        errors.push({
          path: "meta",
          message: `Expected an object — got ${JSON.stringify(value.meta)}`,
        });
      } else if (
        value.meta.description !== undefined &&
        typeof value.meta.description !== "string"
      ) {
        errors.push({ path: "meta.description", message: "Expected a string" });
      }
    }

    return errors.length ? { success: false, errors } : { success: true, data: value as unknown as Field };
  }

  /** Judge an input object against a field map — membership, absence, and who may speak. */
  static row(
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
    const checked = this.value(field, value);
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

  /** The same judgment, as a boolean. */
  static isField(value: unknown): value is Field {
    return this.field(value).success;
  }
}
