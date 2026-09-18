import type { JsonSchema } from '../lib/JsonSchema.js';
import type { ValidationError } from '../lib/ValidationError.js';
import type { Resolver } from './Resolver.js';

export interface Axis<Declared = unknown, Wire = unknown> {
  readonly slot: string;

  readonly format: JsonSchema;

  /** What a format cannot state: `role.relation.to` is a function, and JSON holds none. */
  refusals?(value: unknown): ValidationError[];

  describe(value: Declared, key: string): Wire | undefined;

  reconstruct(wire: Wire, resolve?: Resolver): Declared;
}
