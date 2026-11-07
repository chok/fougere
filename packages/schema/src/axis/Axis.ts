import type { Format } from '../lib/Format.js';
import type { Field } from '../field/Field.js';
import type { ValidationError } from '../lib/ValidationError.js';

export interface Axis {
  readonly format: Format;

  /**
   * What the axis refuses that a format cannot say.
   * Ex: `role.relation.to` must be a function.
   */
  refusals?(value: unknown, declaration: Record<string, unknown>): ValidationError[];

  /** Whether this axis lets the field be missing from an input. */
  admitsAbsence?(field: Field): boolean;
}
