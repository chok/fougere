import type { FieldName, Fields } from './fields/Field.js';
import type { Hints } from './Hints.js';

export type CompositeUnique<TFields extends Fields> = readonly (readonly FieldName<TFields>[])[];

/** New name to old name: the field states what it WAS, which is how a human writes it. */
export type PreviousNames<TFields extends Fields> = Partial<
  Record<FieldName<TFields>, string>
>;

export interface EntityDeclarations<TFields extends Fields> {
  unique?: CompositeUnique<TFields>;
  hints?: Hints<TFields>;
  /**
   * What a field used to be called — read by `fougere freeze` and by nothing else.
   * It answers the one question two shapes cannot, and is meant to be deleted after.
   */
  previous?: PreviousNames<TFields>;
}
