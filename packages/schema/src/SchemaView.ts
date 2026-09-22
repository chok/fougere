import type { Fields } from './field/Fields.js';
import type { FieldGroups } from './entity/FieldGroups.js';
import type { PreviousNames } from './entity/PreviousNames.js';
import type { EntityAdapters } from './entity/EntityAdapters.js';
import type { ValidationResult } from './lib/ValidationResult.js';
import type { ValidateOptions } from './validator/ValidateOptions.js';
import type { SchemaDerivation } from './SchemaDerivation.js';
import type { Values } from './field/Values.js';

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
  getUnique(): FieldGroups<TFields>;
  getIndex(): FieldGroups<TFields>;
  getOpts(): ValidateOptions;
  validate(input: unknown): ValidationResult<Values<TFields>>;
}
