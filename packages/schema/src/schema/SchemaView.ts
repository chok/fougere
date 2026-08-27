import type { Field, Fields } from '../fields/Field.js';
import type { CompositeUnique, PreviousNames } from '../EntityDeclarations.js';
import type { EntityAdapters } from '../EntityAdapters.js';
import type { ValidationResult } from '../judge/result.js';
import type { ValidateOptions } from '../judge/options.js';
import type { SchemaDerivation } from './SchemaDerivation.js';

export type Row<TFields extends Fields> = {
  [K in keyof TFields]: TFields[K] extends Field<infer T> ? T : never;
};

export type PartialRow<TFields extends Fields> = Partial<Row<TFields>>;

export interface SchemaView<TFields extends Fields = Fields> {
  readonly name: string;
  /** What this schema was cut from, when it was cut from anything. */
  readonly derivation?: SchemaDerivation;
  /** What its fields were called before, keyed by the names they carry now. */
  readonly previous?: PreviousNames<TFields>;
  getFields(): TFields;
  getAdapters(): EntityAdapters<TFields> | undefined;
  getUnique(): CompositeUnique<TFields> | undefined;
  getOpts(): ValidateOptions;
  validate(input: unknown): ValidationResult<Row<TFields>>;
}
