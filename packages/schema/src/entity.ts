import { cloneField, resolveBoundary, type Field, type Fields } from "./field/index.js";
import type { Hints } from "./hints.js";
import { validateFields, type ValidationResult, type ValidateOptions } from "./projections/validation.js";
import type { StandardSchemaV1 } from "./projections/standard.js";

// ─── Types ──────────────────────────────────────

/** The data shape an entity carries — every field present. */
export type SchemaViewInfer<TFields extends Fields> = {
  [K in keyof TFields]: TFields[K] extends Field<infer T, any> ? T : never;
};

/** Keys whose value is auto-supplied at creation (primary/auto/default/optional). */
type AutoKeys<TFields extends Fields> = {
  [K in keyof TFields]: TFields[K] extends Field<any, true> ? K : never;
}[keyof TFields];

/**
 * Constructor input — like the data shape, but auto-at-creation fields are
 * optional. `new Post({ title })` works without passing the generated id.
 */
export type CtorInput<TFields extends Fields> =
  Omit<SchemaViewInfer<TFields>, AutoKeys<TFields>> &
  Partial<Pick<SchemaViewInfer<TFields>, AutoKeys<TFields>>>;

/**
 * Fields as seen by a patch input: every field becomes OMISSIBLE (presence axis,
 * `A = true` → optional in the input), but its nullity does NOT change — `null`
 * stays governed by the base field (`optional()`). A patch may leave a field
 * untouched; it may not erase a non-nullable field.
 */
type PatchFields<TFields extends Fields> = {
  [K in keyof TFields]: TFields[K] extends Field<infer T, any> ? Field<T, true> : never;
};

/**
 * A schema constructor returned by Entity.pick(), omit(), partial(), extend().
 *
 * - Usable as a base class: `class X extends Post.pick('id') {}`
 * - Instance type = the data shape (no Infer needed)
 * - Has static methods: getFields(), validate(), pick(), omit(), partial(), extend()
 */
export interface SchemaConstructor<TFields extends Fields> {
  new (data: CtorInput<TFields>): SchemaViewInfer<TFields>;
  readonly '~standard': StandardSchemaV1.Props<Record<string, unknown>, SchemaViewInfer<TFields>>;
  /** The original Entity class this derivation was created from (undefined for compose() results). */
  readonly source?: abstract new (...args: unknown[]) => unknown;
  getFields(): TFields;
  /**
   * Per-consumer hints passed as the 2nd arg of `entity()`. Derivations carry them:
   * pick/omit filter to surviving fields, rename remaps keys, partial/extend pass through.
   */
  getHints(): Hints<TFields> | undefined;
  /** Validation options of this view (e.g. `patch` set by `partial()`). Derivations carry them. */
  getOpts(): ValidateOptions;
  validate(input: unknown): ValidationResult<SchemaViewInfer<TFields>>;
  from(data: Record<string, unknown>): SchemaViewInfer<TFields>;
  pick<K extends string & keyof TFields>(
    ...keys: K[]
  ): SchemaConstructor<Pick<TFields, K>>;
  omit<K extends string & keyof TFields>(
    ...keys: K[]
  ): SchemaConstructor<Omit<TFields, K>>;
  partial(): SchemaConstructor<PatchFields<TFields>>;
  extend<E extends Fields>(
    extra: E,
  ): SchemaConstructor<TFields & E>;
  rename(mapping: Partial<Record<string & keyof TFields, string>>): SchemaConstructor<Fields>;
}

// ─── Factory ────────────────────────────────────

/**
 * The single "trust me" point. The schema class is built from a runtime field-map:
 * its instances get their shape from the constructor *data* (`Object.assign`), not
 * from members written in the class body, and its derivations rebuild maps on the
 * fly. TypeScript sees an empty class, so it cannot prove this matches the precise
 * generic type — one assertion declares that it does. Every schema/mixin library
 * (Effect's `Schema.Class`, ts-mixer, …) carries this same one line. Keeping it
 * here, named and explained, keeps it the *only* such assertion in the package.
 */
function asSchemaConstructor<F extends Fields>(impl: object): SchemaConstructor<F> {
  return impl as SchemaConstructor<F>;
}

/**
 * Carry hints across a field-key transform — the schema-level twin of `cloneField`'s
 * invariant: a derivation preserves everything it doesn't explicitly change. `transform`
 * maps an old key to its new name, or to `undefined` when the field is dropped; each
 * adapter's per-field hints follow their fields.
 */
function deriveHints(
  hints: Hints<Fields> | undefined,
  transform: (key: string) => string | undefined,
): Hints<Fields> | undefined {
  if (!hints) return undefined;
  const out: Record<string, Record<string, unknown>> = {};
  for (const [adapter, perField] of Object.entries(hints as Record<string, Record<string, unknown> | undefined>)) {
    if (!perField || typeof perField !== 'object') continue;
    const mapped: Record<string, unknown> = {};
    for (const [key, hint] of Object.entries(perField)) {
      const next = transform(key);
      if (next !== undefined) mapped[next] = hint;
    }
    if (Object.keys(mapped).length) out[adapter] = mapped;
  }
  return Object.keys(out).length ? (out as Hints<Fields>) : undefined;
}

/** Create a schema constructor from a field record. */
export function createSchemaConstructor<TFields extends Fields>(
  fields: TFields,
  source?: abstract new (...args: unknown[]) => unknown,
  hints?: Hints<TFields>,
  opts: ValidateOptions = {},
): SchemaConstructor<TFields> {
  class Schema {
    /** Trusted constructor — assigns already-shaped data. Validate untrusted input via `validate()`/`from()` first. */
    constructor(data?: Record<string, unknown>) {
      if (data) Object.assign(this, data);
    }
    static get ['~standard'](): StandardSchemaV1.Props<Record<string, unknown>> {
      return {
        version: 1,
        vendor: 'fougere',
        validate(value: unknown) {
          const result = validateFields(fields, value, '', opts);
          if (result.success) {
            return { value: result.data };
          }
          return {
            issues: result.errors.map((e) => ({
              message: e.message,
              path: e.path && e.path !== '.' ? e.path.split('.').map((key) => ({ key })) : undefined,
            })),
          };
        },
      };
    }
    static readonly source = source;
    static getFields() {
      return fields;
    }
    static getHints() {
      return hints;
    }
    static getOpts() {
      return opts;
    }
    static validate(input: unknown) {
      return validateFields(fields, input, '', opts);
    }
    static from(data: Record<string, unknown>) {
      // Trusted projection: keep known keys, drop the rest. Runs the boundary's decode
      // (the same wire→domain step validate() applies) so the returned value matches
      // its declared type — a date-string in becomes the `Date` the type promises.
      // Best-effort: a value that fails to decode is kept as-is rather than dropped.
      const result: Record<string, unknown> = {};
      for (const [key, field] of Object.entries(fields)) {
        if (!(key in data)) continue;
        const value = data[key];
        if (value === null || value === undefined) {
          result[key] = value;
          continue;
        }
        const decoded = resolveBoundary(field).decode(value);
        result[key] = 'error' in decoded ? value : decoded.value;
      }
      return result;
    }
    // Every derivation carries hints and opts — same invariant as cloneField, one
    // level up: change the fields you mean, keep everything else the view holds.
    static pick(...keys: string[]) {
      const picked: Fields = {};
      for (const key of keys) {
        if (fields[key]) picked[key] = fields[key];
      }
      return createSchemaConstructor(picked, source, deriveHints(hints, (k) => (keys.includes(k) ? k : undefined)), opts);
    }
    static omit(...keys: string[]) {
      const omitted: Fields = {};
      for (const [key, value] of Object.entries(fields)) {
        if (!keys.includes(key)) omitted[key] = value;
      }
      return createSchemaConstructor(omitted, source, deriveHints(hints, (k) => (keys.includes(k) ? undefined : k)), opts);
    }
    static partial() {
      // patch mode: an unsent field is omitted ("don't touch"), enforced by
      // ValidateOptions.patch — the fields themselves are untouched, so `null`
      // stays legal only where the base field is nullable. partial() moves the
      // presence axis, never the nullity axis.
      return createSchemaConstructor({ ...fields }, source, hints, { ...opts, patch: true });
    }
    static extend(extra: Fields) {
      return createSchemaConstructor({ ...fields, ...extra }, source, hints, opts);
    }
    static rename(mapping: Record<string, string>) {
      const renamed: Fields = {};
      for (const [key, field] of Object.entries(fields)) {
        renamed[mapping[key] ?? key] = field;
      }
      return createSchemaConstructor(renamed, source, deriveHints(hints, (k) => mapping[k] ?? k), opts);
    }
  }

  return asSchemaConstructor<TFields>(Schema);
}

// ─── Public entry ───────────────────────────────

/**
 * Define an entity — the factory that produces a schema-carrying class.
 *
 * ```ts
 * class Post extends entity({ id: primary(), title: text({ min: 1 }) }) {}
 *
 * new Post({ id, title })   // real instance, data-typed (NOT a bag of Fields)
 * Post.getFields()          // metadata, no instantiation
 * Post.pick('title')        // derived view, same static API
 * function publish(p: Post) // `Post` IS the data type — no Infer needed
 * ```
 *
 * The class carries data + schema metadata only. No business behaviour lives on
 * an entity — that belongs to handlers/commands (keeps form and behaviour apart).
 *
 * An optional 2nd argument carries per-consumer hints (see {@link Hints}) for the
 * irreducible bits a neutral field can't express — only adapters present in the
 * compilation are accepted; the field declarations themselves stay adapter-blind.
 */
export function entity<TFields extends Fields>(
  fields: TFields,
  hints?: Hints<TFields>,
): SchemaConstructor<TFields> {
  return createSchemaConstructor(fields, undefined, hints);
}

// ─── compose — the other entry of the derivation algebra ───

/** Anything that exposes its fields — an `entity()` class or a SchemaConstructor. */
interface HasFields {
  getFields(): Fields;
}

type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

type FieldsFrom<T> = T extends { getFields(): infer F } ? F : Fields;

/**
 * Compose multiple entities/schemas into a single SchemaConstructor.
 *
 * ```ts
 * class User extends compose(UserBase, Timestamps) {}
 * class SearchPosts extends compose(Post.pick('title'), Pagination) {}
 * ```
 *
 * One merge law for EVERYTHING a schema carries — fields, hints, opts: left to
 * right, later sources override earlier ones on conflict (hints merge per adapter,
 * per field key). Use .rename() before compose() to avoid field conflicts.
 */
export function compose<T extends HasFields[]>(
  ...sources: T
): SchemaConstructor<UnionToIntersection<FieldsFrom<T[number]>> & Fields> {
  const merged: Fields = {};
  const mergedHints: Record<string, Record<string, unknown>> = {};
  let mergedOpts: ValidateOptions = {};
  for (const source of sources) {
    Object.assign(merged, source.getFields());
    const carrier = source as Partial<SchemaConstructor<Fields>>;
    const hints = carrier.getHints?.();
    if (hints) {
      for (const [adapter, perField] of Object.entries(hints as Record<string, Record<string, unknown> | undefined>)) {
        if (!perField || typeof perField !== 'object') continue;
        mergedHints[adapter] = { ...mergedHints[adapter], ...perField };
      }
    }
    mergedOpts = { ...mergedOpts, ...carrier.getOpts?.() };
  }
  const hints = Object.keys(mergedHints).length ? (mergedHints as Hints<Fields>) : undefined;
  return asSchemaConstructor<UnionToIntersection<FieldsFrom<T[number]>> & Fields>(
    createSchemaConstructor(merged, undefined, hints, mergedOpts),
  );
}

