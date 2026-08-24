import { Boundary } from './axis/boundary/Boundary.js';
import { type Fields } from './Field.js';
import { deriveHints, type Hints, type Previous } from './EntityDeclarations.js';
import { FieldGroup } from './constraint/FieldGroup.js';
import { Unique } from './constraint/Unique.js';
import { type CompositeUnique } from './EntityDeclarations.js';
import { Judge } from './judge/Judge.js';
import { SchemaDerivation } from './SchemaDerivation.js';
import { type ValidateOptions } from './judge/options.js';
import type { StandardSchemaV1 } from './projection/standard.js';
import type { PartialRow, Row, SchemaView } from './SchemaView.js';

export const ANONYMOUS_SCHEMA_NAME = "Schema";

export interface SchemaConstructor<TFields extends Fields> extends SchemaView<TFields> {
  new (data: PartialRow<TFields>): Row<TFields>;
  readonly "~standard": StandardSchemaV1.Props<Record<string, unknown>, Row<TFields>>;
  readonly derivation?: SchemaDerivation;
  readonly previous?: Previous<TFields>;
  from(data: Record<string, unknown>): Row<TFields>;
  pick<K extends string & keyof TFields>(...keys: K[]): SchemaConstructor<Pick<TFields, K>>;
  omit<K extends string & keyof TFields>(...keys: K[]): SchemaConstructor<Omit<TFields, K>>;
  partial(): SchemaConstructor<TFields>;
  extend<E extends Fields>(extra: E): SchemaConstructor<TFields & E>;
  named(name: string): SchemaConstructor<TFields>;
  rename(mapping: Partial<Record<string & keyof TFields, string>>): SchemaConstructor<Fields>;
}

export class Schema {
  static fields: Fields = {};
  static hints: Hints<Fields> | undefined;
  static opts: ValidateOptions = {};
  static derivation: SchemaDerivation | undefined;
  static previous: Previous<Fields> | undefined;

  constructor(data?: Record<string, unknown>) {
    if (!data) return;
    for (const [key, value] of Object.entries(data)) {
      Object.defineProperty(this, key, { value, writable: true, enumerable: true, configurable: true });
    }
  }

  static getFields() { return this.fields; }
  static getHints() { return this.hints; }
  static getUnique(): CompositeUnique<Fields> | undefined {
    const groups = FieldGroup.groupsOf(this.fields, Unique);
    return groups.length ? groups.map((group) => [...group.members]) : undefined;
  }
  static getOpts() { return this.opts; }

  static validate(input: unknown) {
    return Judge.row(this.fields, input, this.opts);
  }

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
        return {
          issues: result.errors.map((e) => ({
            message: e.message,
            path: e.path && e.path !== "." ? [{ key: e.path }] : undefined,
          })),
        };
      },
    };
  }

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

  static partial() {
    return Schema.of({
      fields: { ...this.fields }, derivation: this.origin(), hints: this.hints,
      opts: { ...this.opts, patch: true },
    });
  }

  static extend(extra: Fields) {
    // The added fields have no origin, so the derivation is unchanged: it speaks of the root.
    return Schema.of({
      fields: { ...this.fields, ...extra }, derivation: this.origin(),
      hints: this.hints, opts: this.opts,
    });
  }

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
  return Schema.of({ fields: merged, hints, opts: mergedOpts }) as unknown as SchemaConstructor<Merged<T>>;
  }

  static of<TFields extends Fields>(stated: {
    fields: TFields;
    derivation?: SchemaDerivation;
    hints?: Hints<TFields>;
    opts?: ValidateOptions;
    previous?: Previous<TFields>;
  }): SchemaConstructor<TFields> {
    class Derived extends Schema {}
    Object.assign(Derived, { opts: {}, ...stated });
    Object.defineProperty(Derived, "name", { value: ANONYMOUS_SCHEMA_NAME, configurable: true });
    return Derived as unknown as SchemaConstructor<TFields>;
  }

  private static derive(fields: Fields, survives: (key: string) => string | undefined) {
    const renamed: Fields = {};
    for (const [key, field] of Object.entries(fields)) renamed[key] = field.rename(survives);
    return Schema.of({
      fields: renamed,
      derivation: this.origin().compose(survives),
      hints: deriveHints(this.hints, survives),
      opts: this.opts,
    });
  }

  /** The derivation this schema already carries, or the one it becomes the root of. */
  private static origin(): SchemaDerivation {
    return this.derivation ?? SchemaDerivation.first(this, this.fields);
  }
}

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
