import { normalizeFields, resolveBoundary, type Field, type Fields } from "./field/index.js";
import type { Hints } from "./hints.js";
import { deriveUnique, deriveUniqueRoles, projectUniqueOntoFields, type CompositeUnique, type EntityDeclarations } from "./unique.js";
import { checkValue, validateFields, type ValidationResult, type ValidateOptions } from "./projections/validation.js";
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
  readonly name: string;
  readonly '~standard': StandardSchemaV1.Props<Record<string, unknown>, SchemaViewInfer<TFields>>;
  /** The original Entity class this derivation was created from (undefined for compose() results). */
  readonly source?: abstract new (...args: never[]) => unknown;
  getFields(): TFields;
  /**
   * Per-consumer hints passed as the 2nd arg of `entity()`. Derivations carry them:
   * pick/omit filter to surviving fields, rename remaps keys, partial/extend pass through.
   */
  getHints(): Hints<TFields> | undefined;
  /**
   * Field groups that are unique together, from the 2nd arg of `entity()`.
   * Derivations carry them; a group loses a member and the group is dropped.
   */
  getUnique(): CompositeUnique<TFields> | undefined;
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
  /** Give an anonymous derivation an explicit runtime name. */
  named(name: string): SchemaConstructor<TFields>;
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

/**
 * Refuse a key the schema does not carry, naming it and what was expected — the twin of
 * `assertListOptions` in `@fougere/core`, applied to the derivation algebra.
 *
 * `pick` skipped an unknown key and `omit` filtered on a key nothing matched, so a typo
 * was silently obeyed. `pick('titel')` returned a view without the field, and — the
 * dangerous half — `omit('ownerUserID')` removed NOTHING: the field stayed in the input
 * view, so the façade's unknown-key refusal no longer applied to it, and a client could
 * write the very field the view was written to close. Measured: the view accepted
 * `ownerUserId: 'someone-else'`.
 *
 * TypeScript catches this at the call site when the key is a literal. It does not when
 * the keys come from a variable, from JSON, or across a package boundary — and a view
 * that quietly widens is not a thing to leave to the type-checker alone.
 */
function assertKnownKeys(operation: string, keys: string[], fields: Fields): void {
  const strangers = keys.filter((key) => !(key in fields));
  if (strangers.length === 0) return;

  throw new Error(
    `${operation}(): unknown field ${strangers.map((s) => `\`${s}\``).join(', ')}. ` +
    `This schema carries ${Object.keys(fields).join(', ')}.`,
  );
}

/** Create a schema constructor from a field record. */
/**
 * The runtime name a derivation carries when no class declaration named it.
 *
 * `class Post extends entity({…}) {}` is named by its declaration; `User.pick('id')` has
 * only the factory's own class to be named after. A reader — the scanner, notably — needs
 * to tell one from the other, so the name is stamped from here rather than read off a
 * class whose identifier someone could rename without noticing the other end.
 */
export const ANONYMOUS_SCHEMA_NAME = 'Schema';

export function createSchemaConstructor<TFields extends Fields>(
  fields: TFields,
  source?: abstract new (...args: never[]) => unknown,
  hints?: Hints<TFields>,
  opts: ValidateOptions = {},
  unique?: CompositeUnique<Fields>,
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
          const result = validateFields(fields, value, opts);
          if (result.success) {
            return { value: result.data };
          }
          return {
            issues: result.errors.map((e) => ({
              message: e.message,
              // ONE segment, not a split: `validateFields` joins with `.` only when it
              // receives a `pathPrefix`, and no caller passes one — the recursion that
              // parameter exists for is not written. So a path is always a single field
              // name, and splitting it invented segments for a name legally spelled `a.b`.
              // The day nested objects report their own path, this becomes a real split
              // and the joining side has to say where the boundaries are.
              path: e.path && e.path !== '.' ? [{ key: e.path }] : undefined,
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
    static getUnique() {
      return unique;
    }
    static getOpts() {
      return opts;
    }
    static validate(input: unknown) {
      return validateFields(fields, input, opts);
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
    //
    // `source ?? this` records WHERE a view came from, once, at the first derivation:
    // `this` is the class the static was called on (`Post`), and a view of a view keeps
    // the origin rather than the intermediate. The slot existed and was only ever
    // propagated — `entity()` passes `undefined` — so `describe` read an empty field and
    // titled a view `Schema`, the anonymous class. One reader assumed it; now two do
    // (GraphQL names `PostStatus` from it, so an input view and the type share one enum).
    static pick(...keys: string[]) {
      assertKnownKeys('pick', keys, fields);
      const picked: Fields = {};
      for (const key of keys) {
        if (fields[key]) picked[key] = fields[key];
      }
      const survives = (k: string) => (keys.includes(k) ? k : undefined);
      return createSchemaConstructor(deriveUniqueRoles(picked, survives), source ?? this, deriveHints(hints, survives), opts, deriveUnique(unique, survives));
    }
    static omit(...keys: string[]) {
      assertKnownKeys('omit', keys, fields);
      const omitted: Fields = {};
      for (const [key, value] of Object.entries(fields)) {
        if (!keys.includes(key)) omitted[key] = value;
      }
      const survives = (k: string) => (keys.includes(k) ? undefined : k);
      return createSchemaConstructor(deriveUniqueRoles(omitted, survives), source ?? this, deriveHints(hints, survives), opts, deriveUnique(unique, survives));
    }
    static partial() {
      // patch mode: an unsent field is omitted ("don't touch"), enforced by
      // ValidateOptions.patch — the fields themselves are untouched, so `null`
      // stays legal only where the base field is nullable. partial() moves the
      // presence axis, never the nullity axis.
      return createSchemaConstructor({ ...fields }, source ?? this, hints, { ...opts, patch: true }, unique);
    }
    static extend(extra: Fields) {
      return createSchemaConstructor({ ...fields, ...extra }, source ?? this, hints, opts, unique);
    }
    static named(name: string) {
      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
        throw new Error(`named(): \`${name}\` is not a valid class name.`);
      }
      // It renames in place, so it may only name what has no name. On a declared class
      // `Post.named('Other')` would silently retarget its table, its GraphQL type and
      // its registration key — every projection reads this name.
      if (this.name !== ANONYMOUS_SCHEMA_NAME) {
        throw new Error(`named(): \`${this.name}\` is already named by its class declaration.`);
      }
      Object.defineProperty(this, 'name', { value: name, configurable: true });
      return this;
    }
    static rename(mapping: Record<string, string>) {
      assertKnownKeys('rename', Object.keys(mapping), fields);
      const renamed: Fields = {};
      for (const [key, field] of Object.entries(fields)) {
        renamed[mapping[key] ?? key] = field;
      }
      const remap = (k: string) => mapping[k] ?? k;
      return createSchemaConstructor(deriveUniqueRoles(renamed, remap), source ?? this, deriveHints(hints, remap), opts, deriveUnique(unique, remap));
    }
  }

  Object.defineProperty(Schema, 'name', { value: ANONYMOUS_SCHEMA_NAME, configurable: true });
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
  declarations?: EntityDeclarations<TFields>,
): SchemaConstructor<TFields> {
  // The door: what comes in is rebuilt into canonical fields, and an entry that is not one
  // is refused here by name. Every reader downstream then holds a field because it was MADE
  // one — the reason nothing needs a brand to ask.
  const own = normalizeFields(fields) as TFields;
  // This is the only place that knows both the field KEYS and the entity's declarations,
  // so it is where a composite group becomes readable on each member's role axis. The
  // declaration remains the source — `getUnique()` still answers it.
  const projected = projectUniqueOntoFields(own, declarations?.unique);
  assertDefaultsAreValid(projected);
  return createSchemaConstructor(projected, undefined, declarations?.hints, {}, declarations?.unique);
}

/**
 * A declared default must satisfy its own shape — checked once, here.
 *
 * `applyCreate` writes it into every row without passing the client judge, which is
 * correct: the judge asks "is what the CALLER sent legal", and this value comes from the
 * author. But that means `text({ min: 5, default: 'ab' })` produced rows the entity's own
 * `validate` refuses — silently on a store that judges nothing, as a constraint violation
 * on SQL, as a validator error on MongoDB. Three symptoms, one cause, none of them naming
 * it.
 *
 * The value is static and so is the shape, so the answer is static: it belongs at the
 * declaration, not on every write. `oneOf` closes its own case in the type system; this
 * catches what no type can — a bound, a pattern, a format.
 */
function assertDefaultsAreValid(fields: Fields): void {
  for (const [name, field] of Object.entries(fields)) {
    const create = field.lifecycle?.create;
    if (typeof create !== 'object' || create === null || !('value' in create)) continue;

    const checked = checkValue(field, (create as { value: unknown }).value);
    if ('error' in checked) {
      throw new Error(
        `Field '${name}': the declared default ${JSON.stringify((create as { value: unknown }).value)} `
        + `is not a legal value for it — ${checked.error}. It would be written into every row `
        + `without passing the judge.`,
      );
    }
  }
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
