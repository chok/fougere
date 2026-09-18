import type { Format } from '../lib/Format.js';
import type { ValidationError } from '../lib/ValidationError.js';
import type { Resolver } from './Resolver.js';

export interface Axis<Declared = unknown, Wire = unknown> {
  readonly format: Format;

  /** What a format cannot state: `role.relation.to` is a function, and JSON holds none. */
  refusals?(value: unknown): ValidationError[];

  /** Stated by an axis whose card differs from its declaration; a card that IS one states neither. */
  describe?(value: Declared, key: string): Wire | undefined;

  reconstruct?(wire: Wire, resolve?: Resolver): Declared;
}
