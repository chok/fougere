import type { Field, Fields } from './Field.js';
import type { Hints } from './EntityDeclarations.js';
import type { CompositeUnique } from './EntityDeclarations.js';
import type { ValidationResult } from './judge/result.js';
import type { ValidateOptions } from './judge/options.js';

export type Row<TFields extends Fields> = {
  [K in keyof TFields]: TFields[K] extends Field<infer T> ? T : never;
};

export type PartialRow<TFields extends Fields> = Partial<Row<TFields>>;

export interface SchemaView<TFields extends Fields = Fields> {
  readonly name: string;
  getFields(): TFields;
  getHints(): Hints<TFields> | undefined;
  getUnique(): CompositeUnique<TFields> | undefined;
  getOpts(): ValidateOptions;
  validate(input: unknown): ValidationResult<Row<TFields>>;
}
