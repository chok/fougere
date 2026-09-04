import type { Field, Fields } from './field/Field.js';
import type { CompositeUnique, PreviousNames } from './entity/EntityDeclarations.js';
import type { EntityAdapters } from './entity/EntityAdapters.js';
import type { ValidationResult } from './result.js';
import type { ValidateOptions } from './judge/options.js';
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
  /** Does it hold rows of its own? False on a derivation means an answer. */
  readonly anchored?: boolean;
  getFields(): TFields;
  getAdapters(): EntityAdapters<TFields>;
  getUnique(): CompositeUnique<TFields> | undefined;
  getOpts(): ValidateOptions;
  validate(input: unknown): ValidationResult<Row<TFields>>;
}
