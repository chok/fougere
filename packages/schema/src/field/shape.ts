import type { JSONSchema7 } from 'json-schema';

// ─── Axis 1 · shape — the VALUE ──────────────────────────────
// What a stand-alone value validator (zod, typebox) would cover: the kind of
// value and its intrinsic constraints. Nothing here knows about a database or
// a domain. Absent for relation-only fields (`many`), which carry no value of
// their own.
//
// The vocabulary is JSON Schema's own (`type` + `minLength`/`minimum`/`format`…),
// so the portable descriptor is a near-identity projection — no shape↔JSON-Schema
// mapping to maintain. A date is JSON Schema's `{ type: 'string', format: 'date-time' }`;
// an integer is the `integer` type, not a flag.
//
// NULLABILITY lives in the grammar, not beside it: a nullable value's `type` is
// the union `[T, 'null']` (and `null` joins `enum` when present) — the standard's
// own idiom, judged natively by the engine. A flat `nullable` flag would put a
// second source of truth next to the grammar (flag says yes, enum says no —
// OpenAPI 3.0's exact bug, fixed in 3.1 by this same move). Writers go through
// {@link nullableShape}; readers go through {@link anatomy} — NEVER compare
// `shape.type === '...'` directly, the union breaks it silently.

// JSON Schema's own format names (assertion supported by the cfworker engine).
// `date-time` is special: it derives the isoDate boundary; the others are pure predicates.
//
// The union is OPEN — `(string & {})` keeps autocomplete on the built-ins while
// leaving room for {@link registerFormat}, exactly as `GeneratorRef` and
// `BoundaryRef` already do on their own axes. `format` is the one JSON Schema
// keyword whose vocabulary the standard itself declares open, which is why a
// custom predicate rides here and not in a keyword of our own: a key outside
// `keyof JSONSchema7` would fail the conformance assertion at the bottom of this
// file, and rightly so.
export type StringFormat =
  | 'date-time'
  | 'date'
  | 'time'
  | 'email'
  | 'uuid'
  | 'uri'
  | (string & {});

// ─── Custom formats (open registry — same spirit as the other two axes) ─────

/**
 * A custom format's predicate: one value, one verdict.
 *
 * No message, deliberately — a custom format fails exactly like `email` does,
 * because the NAME is the contract and a consumer reading the card cannot tell
 * ours from the standard's.
 */
export type FormatPredicate = (value: string) => boolean;

const formats = new Map<string, FormatPredicate>();

/**
 * Register a format the engine does not ship — `registerFormat('siret', luhn)`
 * makes `text({ format: 'siret' })` judged.
 *
 * Same shape as {@link registerGenerator} and {@link registerDecoder}: the field
 * declares a NAME, a module supplies the realization. That is what lets the rule
 * cross a process or a language — the card carries `"format": "siret"`, which is
 * legal JSON Schema, and each runtime registers its own implementation under that
 * name. The truth travels; the realization varies.
 *
 * The registry is OURS, not the engine's. Writing into `@cfworker/json-schema`'s
 * own `format` table would work and be one line shorter, but nothing documents it
 * as an extension point, and it would weld the framework to one engine — the very
 * thing this dependency is meant to keep replaceable (it was chosen for having no
 * `eval`, not for its API).
 *
 * Registering a name the engine ALREADY judges is legal and cumulative: both
 * predicates run and both must pass, so `registerFormat('email', stricter)` makes
 * e-mails stricter and never replaces the standard rule.
 */
export function registerFormat(name: string, predicate: FormatPredicate): void {
  formats.set(name, predicate);
}

/** A registered custom format, or undefined — the reader the judge goes through. */
export function resolveFormat(name: string): FormatPredicate | undefined {
  return formats.get(name);
}

/** A base type name, alone or in the nullable union form. */
type Nullably<T extends string> = T | readonly [T, 'null'];

// The constraint body of each shape kind — shared by `Shape` (declared, `type`
// possibly the nullable union) and `BaseShape` (read via `anatomy`, `type` scalar).
interface StringConstraints { minLength?: number; maxLength?: number; pattern?: string; enum?: readonly (string | null)[]; format?: StringFormat }
interface NumericConstraints { minimum?: number; maximum?: number }
// A list of VALUES (`list(text())`) — `items` is the element's own shape, validated
// natively by the engine. A `many()` relation is NOT this: it has no shape at all.
// `items` is optional because `array` covers two things, exactly as the card already
// spells them: a value list (`list(text())`) carries the element shape, a `many`
// relation carries none — its elements live on the other side and the role names them.
// `FieldDescriptor.items` was already optional; this is the same statement, in memory.
interface ArrayConstraints { items?: Shape; minItems?: number; maxItems?: number }
// `json()` → bare (opaque passthrough); `json(Entity)` → the embedded entity's own
// shape projection (`properties`/`required` are JSON Schema's nesting, so the engine
// validates the nested structure natively and the descriptor travels verbatim).
interface ObjectConstraints { properties?: Record<string, unknown>; required?: readonly string[] }

export type Shape =
  | ({ type: Nullably<'string'> } & StringConstraints)
  | ({ type: Nullably<'number'> | Nullably<'integer'> } & NumericConstraints)
  | { type: Nullably<'boolean'> }
  | ({ type: Nullably<'array'> } & ArrayConstraints)
  | ({ type: Nullably<'object'> } & ObjectConstraints);

/**
 * The BASE type names — what `anatomy(shape).base?.type` narrows to for a dispatch.
 *
 * The runtime list is the source and the type derives from it, not the reverse: a type
 * union cannot be enumerated at runtime, so writing both by hand means two lists that
 * drift. {@link isShape} needs the values, so it is the values that are declared.
 */
export const SHAPE_TYPES = ['string', 'number', 'integer', 'boolean', 'array', 'object'] as const;
export type ShapeType = (typeof SHAPE_TYPES)[number];

/**
 * Is this a shape? Asked of its `type`, which is the one thing every shape states and
 * the one thing the engine dispatches on.
 *
 * The weaker question — "is there a `shape` key at all" — is the one this package spent a
 * refactor removing elsewhere, and it was still being asked here: `{ shape: 42 }` built a
 * field that crashed inside the validator (`Invalid value used as weak map key`), while
 * `{ shape: {} }` built one that judged NOTHING and answered `true` to every value. Both
 * are the shapeless field again, one level down.
 *
 * `null` is legal only inside the union — `['string','null']` is how nullability is
 * spelled — never on its own: a field whose only type is `null` states no value.
 */
export function isShape(value: unknown): value is Shape {
  if (typeof value !== 'object' || value === null) return false;
  const declared = (value as Shape).type;
  const names = Array.isArray(declared) ? declared : [declared];
  return (
    names.some((name) => (SHAPE_TYPES as readonly unknown[]).includes(name)) &&
    names.every((name) => name === 'null' || (SHAPE_TYPES as readonly unknown[]).includes(name))
  );
}

/**
 * `Shape` with `type` guaranteed scalar — what `anatomy` returns as `base`, the
 * ONLY form consumers dispatch on. A scalar literal is a real discriminant, so
 * `switch (base?.type)` narrows; the raw `Shape` union can't (the `[T,'null']`
 * tuple is not a unit type).
 */
export type BaseShape =
  | ({ type: 'string' } & StringConstraints)
  | ({ type: 'number' | 'integer' } & NumericConstraints)
  | { type: 'boolean' }
  | ({ type: 'array' } & ArrayConstraints)
  | ({ type: 'object' } & ObjectConstraints);

// ─── nullableShape / anatomy — the two gates of the union ──────────

/**
 * Write side: make a shape's grammar accept `null` — the type becomes the union
 * `[T, 'null']`, and `null` joins `enum` when present (an enum is a closed value
 * set; null must be IN it to be legal). Idempotent.
 */
export function nullableShape(shape: Shape): Shape {
  if (Array.isArray(shape.type)) return shape;
  const out = { ...shape, type: [shape.type, 'null'] } as unknown as Shape;
  if ('enum' in out && out.enum && !out.enum.includes(null)) {
    (out as { enum: readonly (string | null)[] }).enum = [...out.enum, null];
  }
  return out;
}

/** A shape split back into its base grammar and its nullability. */
export interface ShapeAnatomy {
  /** The shape stripped of `null` (scalar `type`, `enum` without null) — dispatch on THIS. */
  base?: BaseShape;
  nullable: boolean;
}

const anatomies = new WeakMap<object, ShapeAnatomy>();
const NO_SHAPE: ShapeAnatomy = { base: undefined, nullable: false };

/**
 * Read side — the single customs post at the standard's border. Every consumer
 * that dispatches on a shape's type MUST come through here: `shape.type` may be
 * the union `[T, 'null']`, and a direct `shape.type === 'string'` comparison
 * fails silently on it. Cached per shape reference (shapes are stable — the
 * derivations copy field refs, they never rebuild shapes).
 */
export function anatomy(shape?: Shape): ShapeAnatomy {
  if (!shape) return NO_SHAPE;
  let a = anatomies.get(shape);
  if (!a) {
    if (Array.isArray(shape.type)) {
      const baseType = shape.type.find((t) => t !== 'null');
      const base = { ...shape, type: baseType } as BaseShape;
      if ('enum' in base && base.enum) {
        (base as { enum: readonly (string | null)[] }).enum = base.enum.filter((v) => v !== null);
      }
      a = { base, nullable: true };
    } else {
      a = { base: shape as BaseShape, nullable: false };
    }
    anatomies.set(shape, a);
  }
  return a;
}

/** Sugar for the most common read: does this shape's grammar accept `null`? */
export function isNullable(shape?: Shape): boolean {
  return anatomy(shape).nullable;
}

// ─── Garde-fou : `Shape` reste un sous-ensemble de JSON Schema ──────
// La validation délègue à un moteur JSON Schema (cfworker) qui IGNORE en silence
// tout mot-clé hors spec. Cette assertion type-only fait échouer le build si un
// mot-clé non-JSON-Schema entre dans `Shape` — l'équation « shape = JSON Schema »
// est tenue par le compilateur, pas par la discipline. `keyof JSONSchema7` est un
// union fini de mots-clés (l'interface est fermée), d'où la comparaison.
type Assert<T extends true> = T;
type ShapeKeys<T> = T extends unknown ? keyof T : never; // distribue keyof sur l'union
type _ShapeConformsToJsonSchema = Assert<
  [Exclude<ShapeKeys<Shape>, keyof JSONSchema7>] extends [never] ? true : false
>;
