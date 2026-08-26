import type { Fields } from "./Field.js";
import type { Hints } from "./Hints.js";

export type CompositeUnique<TFields extends Fields> = ReadonlyArray<
  ReadonlyArray<Extract<keyof TFields, string>>
>;

export interface EntityDeclarations<TFields extends Fields> {
  unique?: CompositeUnique<TFields>;
  hints?: Hints<TFields>;
  /**
   * What a field used to be called — read by `fougere freeze` and by nothing else.
   * It answers the one question two shapes cannot, and is meant to be deleted after.
   */
  previous?: Previous<TFields>;
}

/** New name to old name: the field states what it WAS, which is how a human writes it. */
export type Previous<TFields extends Fields> = {
  readonly [K in Extract<keyof TFields, string>]?: string;
};
