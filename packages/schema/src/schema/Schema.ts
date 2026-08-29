import { Boundary } from '../axis/boundary/Boundary.js';
import { type Fields } from '../fields/Field.js';
import {
  type CompositeUnique,
  type EntityDeclarations,
  type PreviousNames,
} from '../EntityDeclarations.js';
import { EntityAdapterSet, type EntityAdapters } from '../EntityAdapters.js';
import { FieldGroup } from '../constraint/FieldGroup.js';
import { Unique } from '../constraint/Unique.js';
import { RowJudge } from '../judge/RowJudge.js';
import { SchemaDerivation } from './SchemaDerivation.js';
import { SchemaDefinition } from './SchemaDefinition.js';
import { type ValidateOptions } from '../judge/options.js';
import type { StandardSchemaV1 } from '../projection/standard.js';
import type { PartialRow, Row, SchemaView } from './SchemaView.js';

export const ANONYMOUS_SCHEMA_NAME = "Schema";

export interface SchemaConstructor<TFields extends Fields> extends SchemaView<TFields> {
  new (data: PartialRow<TFields>): Row<TFields>;
  readonly "~standard": StandardSchemaV1.Props<Record<string, unknown>, Row<TFields>>;
  readonly derivation?: SchemaDerivation;
  readonly previous?: PreviousNames<TFields>;
  readonly anchored?: boolean;
  from(data: Record<string, unknown>): Row<TFields>;
  pick<K extends string & keyof TFields>(...keys: K[]): SchemaConstructor<Pick<TFields, K>>;
  omit<K extends string & keyof TFields>(...keys: K[]): SchemaConstructor<Omit<TFields, K>>;
  partial(): SchemaConstructor<TFields>;
  extend<E extends Fields>(extra: E): SchemaConstructor<TFields & E>;
  declares(declarations: EntityDeclarations<TFields>): SchemaConstructor<TFields>;
  anchor(): SchemaConstructor<TFields>;
  named(name: string): SchemaConstructor<TFields>;
  rename(mapping: Partial<Record<string & keyof TFields, string>>): SchemaConstructor<Fields>;
}

export class Schema {
  /** The one place a schema holds what it is. The readings below are its projections. */
  static definition: SchemaDefinition = SchemaDefinition.stated({ fields: {} });

  static get fields(): Fields { return this.definition.fields; }
  static get adapters(): EntityAdapters<Fields> | undefined { return this.definition.adapters; }
  static get opts(): ValidateOptions { return this.definition.opts; }
  static get derivation(): SchemaDerivation | undefined { return this.definition.derivation; }
  static get previous(): PreviousNames<Fields> | undefined { return this.definition.previous; }
  static get anchored(): boolean { return this.definition.anchored; }

  constructor(data?: Record<string, unknown>) {
    if (!data) return;
    for (const [key, value] of Object.entries(data)) {
      Object.defineProperty(this, key, { value, writable: true, enumerable: true, configurable: true });
    }
  }

  static getFields() { return this.fields; }
  static getAdapters() { return this.adapters; }
  static getUnique(): CompositeUnique<Fields> | undefined {
    const groups = FieldGroup.groupsOf(this.fields, Unique);
    return groups.length ? groups.map((group) => [...group.members]) : undefined;
  }
  static getOpts() { return this.opts; }

  static validate(input: unknown) {
    return RowJudge.of(this.fields, this.opts).check(input);
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
        const result = RowJudge.of(fields, opts).check(value);
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

  /**
   * Everything a schema states about ITSELF, available wherever a schema is. `entity(fields, …)`
   * is this same gesture at the declaration site; the fields do not move, so neither does the type.
   */
  static declares(declarations: EntityDeclarations<Fields>) {
    const addressed = EntityAdapterSet.of(declarations.adapters)?.fieldNames ?? [];
    assertKnownKeys("declares", [...addressed, ...Object.keys(declarations.previous ?? {})], this.fields);

    return Schema.subclass(this.definition.declaring(declarations));
  }

  /**
   * This schema holds rows of its own — every entity is one, and a derivation says so.
   *
   * An anchor is where a walk STOPS: `derivation.anchor` climbs to the nearest one, and what
   * is cut from an anchor roots on it. Two anchors are two entities that happen to share a
   * shape, never a hierarchy — nothing here subtypes, so a relation between them is `ref()`.
   */
  static anchor() {
    return Schema.subclass(this.definition.anchoring());
  }

  static partial() {
    return Schema.subclass(this.definition.patched(this));
  }

  static extend(extra: Fields) {
    return Schema.subclass(this.definition.extended(extra, this));
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
    return Schema.subclass(SchemaDefinition.merged(sources)) as unknown as SchemaConstructor<Merged<T>>;
  }

  static of<TFields extends Fields>(stated: {
    fields: TFields;
    derivation?: SchemaDerivation;
    adapters?: EntityAdapters<TFields>;
    opts?: ValidateOptions;
    previous?: PreviousNames<TFields>;
    anchored?: boolean;
  }): SchemaConstructor<TFields> {
    return Schema.subclass(SchemaDefinition.stated(stated)) as unknown as SchemaConstructor<TFields>;
  }

  /** The class a definition becomes. The one place a Schema subclass is born. */
  private static subclass(definition: SchemaDefinition): SchemaConstructor<Fields> {
    class Derived extends Schema {}
    Derived.definition = definition;
    Object.defineProperty(Derived, "name", { value: ANONYMOUS_SCHEMA_NAME, configurable: true });
    return Derived as unknown as SchemaConstructor<Fields>;
  }

  private static derive(fields: Fields, survives: (key: string) => string | undefined) {
    return Schema.subclass(this.definition.cut(fields, survives, this));
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
