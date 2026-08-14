import type { Field, Fields } from "../field/index.js";
import type { Hints } from "../hints.js";
import type { CompositeUnique } from "../unique.js";
import type { ValidationResult, ValidateOptions } from '../validation/index.js';
import type { StandardSchemaV1 } from "../projections/standard.js";

/** The row an entity carries — its fields' value types, all present. */
export type Row<TFields extends Fields> = {
  [K in keyof TFields]: TFields[K] extends Field<infer T> ? T : never;
};

/** A row as handed to the constructor — every key omissible. */
export type PartialRow<TFields extends Fields> = Partial<Row<TFields>>;

/**
 * What a schema ANSWERS. No construct signature, so a class carrying a body satisfies it —
 * and `Fields` by default, for a reader that does not care which map it holds.
 */
export interface SchemaView<TFields extends Fields = Fields> {
  readonly name: string;
  getFields(): TFields;
  /** Per-consumer hints from the 2nd arg of `entity()`. Derivations carry them. */
  getHints(): Hints<TFields> | undefined;
  /** Field groups unique together, from the 2nd arg of `entity()`. */
  getUnique(): CompositeUnique<TFields> | undefined;
  /** This view's validation mode — `patch` is set by `partial()`. */
  getOpts(): ValidateOptions;
  validate(input: unknown): ValidationResult<Row<TFields>>;
}
