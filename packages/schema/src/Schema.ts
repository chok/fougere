import { Boundary } from './axis/boundary/Boundary.js';
import { type Fields } from './field/Field.js';
import {
  type CompositeUnique,
  type EntityDeclarations,
  type PreviousNames,
} from './entity/EntityDeclarations.js';
import { type EntityAdapters } from './entity/EntityAdapters.js';
import { InputValidator } from './validator/InputValidator.js';
import { SchemaDerivation } from './SchemaDerivation.js';
import { SchemaDefinition, type SchemaConstraints } from './SchemaDefinition.js';
import { type ValidateOptions } from './validator/InputValidator.js';
import type { StandardSchemaV1 } from './projection/standard.js';
import type { PartialValues, Values, SchemaView } from './SchemaView.js';

export const ANONYMOUS_SCHEMA_NAME = 'Schema';

export interface SchemaConstructor<TFields extends Fields> extends SchemaView<TFields> {
  new (data: PartialValues<TFields>): Values<TFields>;
  readonly '~standard': StandardSchemaV1.Props<Record<string, unknown>, Values<TFields>>;
  readonly derivation?: SchemaDerivation;
  readonly previous?: PreviousNames<TFields>;
  readonly anchored?: boolean;
  from(data: Record<string, unknown>): Values<TFields>;
  pick<K extends string & keyof TFields>(
    ...keys: K[]
  ): SchemaConstructor<Pick<TFields, K>>;
  omit<K extends string & keyof TFields>(
    ...keys: K[]
  ): SchemaConstructor<Omit<TFields, K>>;
  partial(): SchemaConstructor<TFields>;
  extend<E extends Fields>(extra: E): SchemaConstructor<TFields & E>;
  declares(declarations: EntityDeclarations<TFields>): SchemaConstructor<TFields>;
  anchor(): SchemaConstructor<TFields>;
  named(name: string): SchemaConstructor<TFields>;
  rename(
    mapping: Partial<Record<string & keyof TFields, string>>,
  ): SchemaConstructor<Fields>;
}

export class Schema {
  /** The one place a schema holds what it is. The readings below are its projections. */
  static definition: SchemaDefinition = SchemaDefinition.of({ fields: {} });

  static get derivation(): SchemaDerivation | undefined {
    return this.definition.derivation;
  }
  static get previous(): PreviousNames<Fields> | undefined {
    return this.definition.previous;
  }
  /** An anchor holds rows of its own; a derivation borrows them. */
  static get anchored(): boolean {
    return this.definition.anchored;
  }

  constructor(data?: Record<string, unknown>) {
    if (!data) return;
    for (const [key, value] of Object.entries(data)) {
      Object.defineProperty(this, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
  }

  static getFields(): Fields {
    return this.definition.fields;
  }
  /** An entry survives every derivation that kept its field: `Post.pick('body').getAdapters()`. */
  static getAdapters(): EntityAdapters<Fields> {
    return this.definition.adapterSet.adapters;
  }
  static getUnique(): CompositeUnique<Fields> | undefined {
    return this.definition.constraints.unique;
  }
  static getOpts(): ValidateOptions {
    return this.definition.opts;
  }

  static validate(input: unknown) {
    const { fields, opts } = this.definition;

    return InputValidator.of(fields, opts).validate(input);
  }

  static from(data: Record<string, unknown>) {
    const row: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(this.definition.fields)) {
      if (!Object.hasOwn(data, key)) continue;
      const value = data[key];
      if (value === null || value === undefined) {
        row[key] = value;
        continue;
      }
      const decoded = Boundary.of(field).decode(value);
      row[key] = 'error' in decoded ? value : decoded.value;
    }
    return row;
  }

  static get ['~standard'](): StandardSchemaV1.Props<Record<string, unknown>> {
    const { fields, opts } = this.definition;

    return {
      version: 1,
      vendor: 'fougere',
      validate(value: unknown) {
        const verdict = InputValidator.of(fields, opts).validate(value);
        if (verdict.success) return { value: verdict.data };
        return {
          issues: verdict.errors.map((e) => ({
            message: e.message,
            path: e.path && e.path !== '.' ? [{ key: e.path }] : undefined,
          })),
        };
      },
    };
  }

  static pick(...keys: string[]) {
    return Schema.subclass(this.definition.pick(keys, this));
  }

  static omit(...keys: string[]) {
    return Schema.subclass(this.definition.omit(keys, this));
  }

  static rename(mapping: Record<string, string>) {
    return Schema.subclass(this.definition.rename(mapping, this));
  }

  static declares(declarations: EntityDeclarations<Fields>) {
    return Schema.subclass(this.definition.declaring(declarations));
  }

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
      throw new Error(
        `named(): \`${this.name}\` is already named by its class declaration.`,
      );
    }
    Object.defineProperty(this, 'name', { value: name, configurable: true });
    return this;
  }

  static compose<T extends SchemaView[]>(...sources: T): SchemaConstructor<Merged<T>> {
    return Schema.subclass(
      SchemaDefinition.merged(sources),
    ) as unknown as SchemaConstructor<Merged<T>>;
  }

  static of<TFields extends Fields>(declaration: {
    fields: TFields;
    derivation?: SchemaDerivation;
    adapters?: EntityAdapters<TFields>;
    opts?: ValidateOptions;
    previous?: PreviousNames<TFields>;
    anchored?: boolean;
    constraints?: SchemaConstraints;
  }): SchemaConstructor<TFields> {
    return Schema.subclass(
      SchemaDefinition.of(declaration),
    ) as unknown as SchemaConstructor<TFields>;
  }

  private static subclass(definition: SchemaDefinition): SchemaConstructor<Fields> {
    class Derived extends Schema {}
    Derived.definition = definition;
    Object.defineProperty(Derived, 'name', {
      value: ANONYMOUS_SCHEMA_NAME,
      configurable: true,
    });
    return Derived as unknown as SchemaConstructor<Fields>;
  }
}

type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;
type Merged<T extends SchemaView[]> = UnionToIntersection<
  T[number] extends { getFields(): infer F } ? F : Fields
> &
  Fields;
