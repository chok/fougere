import type { Format } from '../lib/Format.js';
import type { Field } from '../field/Field.js';
import type { ValidationError } from '../lib/ValidationError.js';

export interface Axis {
  readonly format: Format;

  /**
   * What a format cannot state: `role.relation.to` is a function, and JSON holds none.
   * The whole declaration comes with the slot, because a contradiction is a PAIR — a
   * primary key that admits null states one legal `role` beside one legal `shape`.
   */
  refusals?(value: unknown, declaration: Record<string, unknown>): ValidationError[];

  /**
   * Whether this axis alone lets the field be absent from what a caller sends. Asked of every
   * REGISTERED axis, so a fourth one weighs on it without the validator naming it.
   */
  admitsAbsence?(field: Field): boolean;
}
