import type { Format } from '../lib/Format.js';
import type { ValidationError } from '../lib/ValidationError.js';

export interface Axis {
  readonly format: Format;

  /** What a format cannot state: `role.relation.to` is a function, and JSON holds none. */
  refusals?(value: unknown): ValidationError[];
}
