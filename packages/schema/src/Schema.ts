import { Boundary } from './axis/boundary/Boundary.js';
import { type Fields } from './Field.js';
import { deriveHints, type Hints } from './EntityDeclarations.js';
import { FieldGroup } from './axis/role/FieldGroup.js';
import { Unique } from './axis/role/Unique.js';
import { type CompositeUnique } from './EntityDeclarations.js';
import { Judge } from './judge/Judge.js';
import { type ValidateOptions } from './judge/options.js';
import type { StandardSchemaV1 } from './projection/standard.js';
import type { PartialRow, Row, SchemaView } from './SchemaView.js';

/** The name a derivation carries when no class declaration named it. */
export const ANONYMOUS_SCHEMA_NAME = "Schema";

/** A schema view that also constructs and derives. */
export interface SchemaConstructor<TFields extends Fields> extends SchemaView<TFields> {
  new (data: PartialRow<TFields>): Row<TFields>;
  readonly "~standard": StandardSchemaV1.Props<Record<string, unknown>, Row<TFields>>;
  /** The Entity class this derivation came from — absent on a `Schema.compose()` result. */
  readonly source?: abstract new (...args: never[]) => unknown;
  from(data: Record<string, unknown>): Row<TFields>;
  pick<K extends string & keyof TFields>(...keys: K[]): SchemaConstructor<Pick<TFields, K>>;
  omit<K extends string & keyof TFields>(...keys: K[]): SchemaConstructor<Omit<TFields, K>>;
  partial(): SchemaConstructor<TFields>;
  extend<E extends Fields>(extra: E): SchemaConstructor<TFields & E>;
  /** Give an anonymous derivation an explicit runtime name. */
  named(name: string): SchemaConstructor<TFields>;
  rename(mapping: Partial<Record<string & keyof TFields, string>>): SchemaConstructor<Fields>;
}

/**
 * The carrier. Its data lives on the class, so `this` resolves it and a derivation is a
 * subclass with a different map — `Post.pick('id')` reads `Post.fields`, not a closure.
 */
export class Schema {
  static fields: Fields = {};
  static hints: Hints<Fields> | undefined;
  static opts: ValidateOptions = {};
  static source: (abstract new (...args: never[]) => unknown) | undefined;

  /** Trusted: takes already-shaped data. Untrusted input goes through `validate`/`from`. */
  constructor(data?: Record<string, unknown>) {
    if (!data) return;
    // Define, never assign: `Object.assign` writes through [[Set]], so a `__proto__` key
    // from a parsed JSON row fires the setter and replaces this instance's prototype.
    for (const [key, value] of Object.entries(data)) {
      Object.defineProperty(this, key, { value, writable: true, enumerable: true, configurable: true });
    }
  }

  static getFields() { return this.fields; }
  static getHints() { return this.hints; }
  /** Derived: the composite groups the fields state together — no second copy to keep in step. */
  static getUnique(): CompositeUnique<Fields> | undefined {
    const groups = FieldGroup.groupsOf(this.fields, Unique);
    return groups.length ? groups.map((group) => [...group.members]) : undefined;
  }
  static getOpts() { return this.opts; }

  static validate(input: unknown) {
    return Judge.row(this.fields, input, this.opts);
  }

  /** Trusted: keeps known keys, decodes each through its boundary, leaves the rest. */
  static from(data: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(this.fields)) {
      if (!(key in data)) continue;
      const value = data[key];
      if (value === null || value === undefined) { out[key] = value; continue; }
      const decoded = Boundary.of(field).decode(value);
      out[key] = "error" in decoded ? value : decoded.value;
    }
    return out;
  }

  static get ["~standard"](): StandardSchemaV1.Props<Record<string, unknown>> {
    const { fields, opts } = this;
    return {
      version: 1,
      vendor: "fougere",
      validate(value: unknown) {
        const result = Judge.row(fields, value, opts);
        if (result.success) return { value: result.data };
        // ONE segment, not a split: a path is always a single field name until nested
        // objects report their own, so splitting invented segments for a name like `a.b`.
        return {
          issues: result.errors.map((e) => ({
            message: e.message,
            path: e.path && e.path !== "." ? [{ key: e.path }] : undefined,
          })),
        };
      },
    };
  }

  // ─── The derivation algebra ───
  // Each derivation states its difference and keeps the rest. `source ?? this` records
  // the ORIGIN once: a view of a view keeps it rather than the intermediate.
  static pick(...keys: string[]) {
    assertKnownKeys("pick", keys, this.fields);
    const picked: Fields = {};
    for (const key of keys) if (this.fields[key]) picked[key] = this.fields[key];
    return this.derive(picked, (k) => (keys.includes(k) ? k : undefined));
  }

  static omit(...keys: string[]) {
    assertKnownKeys("omit", keys, this.fields);
    const kept: Fields = {};
    for (const [key, field] of Object.entries(this.fields)) if (!keys.includes(key)) kept[key] = field;
    return this.derive(kept, (k) => (keys.includes(k) ? undefined : k));
  }

  static rename(mapping: Record<string, string>) {
    assertKnownKeys("rename", Object.keys(mapping), this.fields);
    const renamed: Fields = {};
    for (const [key, field] of Object.entries(this.fields)) renamed[mapping[key] ?? key] = field;
    return this.derive(renamed, (k) => mapping[k] ?? k);
  }

  /** Patch mode: an unsent field is untouched. Moves the presence axis, never nullity. */
  static partial() {
    return Schema.of({ ...this.fields }, this.source ?? this, this.hints, { ...this.opts, patch: true });
  }

  static extend(extra: Fields) {
    return Schema.of({ ...this.fields, ...extra }, this.source ?? this, this.hints, this.opts);
  }

  /**
   * Renames in place, so it may only name what has no name — on a declared class it would
   * silently retarget its table, its GraphQL type and its registration key.
   */
  static named(name: string) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
      throw new Error(`named(): \`${name}\` is not a valid class name.`);
    }
    if (this.name !== ANONYMOUS_SCHEMA_NAME) {
      throw new Error(`named(): \`${this.name}\` is already named by its class declaration.`);
    }
    Object.defineProperty(this, "name", { value: name, configurable: true });
    return this;
  }

  /**
   * Merge schemas into one — `class User extends Schema.compose(UserBase, Timestamps) {}`.
   * Left to right, later sources win on conflict. Use `.rename()` first to avoid one.
   *
   * A static and not a free function: it FABRICATES a schema, like {@link Schema.of}, and
   * what fabricates belongs to what it fabricates.
   */
  static compose<T extends SchemaView[]>(...sources: T): SchemaConstructor<Merged<T>> {
  const merged: Fields = {};
  const mergedHints: Record<string, Record<string, unknown>> = {};
  let mergedOpts: ValidateOptions = {};
  for (const source of sources) {
    Object.assign(merged, source.getFields());
    const hints = source.getHints();
    if (hints) {
      for (const [adapter, perField] of Object.entries(hints as Record<string, Record<string, unknown> | undefined>)) {
        if (!perField || typeof perField !== "object") continue;
        mergedHints[adapter] = { ...mergedHints[adapter], ...perField };
      }
    }
    mergedOpts = { ...mergedOpts, ...source.getOpts() };
  }
  const hints = Object.keys(mergedHints).length ? (mergedHints as Hints<Fields>) : undefined;
  return Schema.of(merged, undefined, hints, mergedOpts) as unknown as SchemaConstructor<Merged<T>>;
  }

  /**
   * The subclass every entity and every derivation is made of — the only way a schema
   * exists. The map and the declarations become statics; the instance side is the row.
   *
   * ```ts
   * const C = Schema.of({ title: text() })
   * C.getFields()          // → { title: Field }
   * C.name                 // → 'Schema', until `class Post extends …` or `named()`
   * new C({ title: 'A' })  // → a row
   * ```
   */
  static of<TFields extends Fields>(
    fields: TFields,
    source?: abstract new (...args: never[]) => unknown,
    hints?: Hints<TFields>,
    opts: ValidateOptions = {},
  ): SchemaConstructor<TFields> {
    class Derived extends Schema {}
    Object.assign(Derived, { fields, source, hints, opts });
    Object.defineProperty(Derived, "name", { value: ANONYMOUS_SCHEMA_NAME, configurable: true });
    // TS sees an empty subclass and cannot prove it matches the precise map.
    return Derived as unknown as SchemaConstructor<TFields>;
  }

  /**
   * A key transform. Each field renames what it carries — the storage rules travel with the
   * fields they name, so there is one carry here and not one per kind of declaration.
   */
  private static derive(fields: Fields, survives: (key: string) => string | undefined) {
    const renamed: Fields = {};
    for (const [key, field] of Object.entries(fields)) renamed[key] = field.rename(survives);
    return Schema.of(renamed, this.source ?? this, deriveHints(this.hints, survives), this.opts);
  }
}

/** Refuse a key the schema does not carry — a typo in `pick`/`omit` used to be obeyed. */
function assertKnownKeys(operation: string, keys: string[], fields: Fields): void {
  const strangers = keys.filter((key) => !(key in fields));
  if (strangers.length === 0) return;
  throw new Error(
    `${operation}(): unknown field ${strangers.map((s) => `\`${s}\``).join(", ")}. ` +
      `This schema carries ${Object.keys(fields).join(", ")}.`,
  );
}

type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
type Merged<T extends SchemaView[]> = UnionToIntersection<T[number] extends { getFields(): infer F } ? F : Fields> & Fields;

