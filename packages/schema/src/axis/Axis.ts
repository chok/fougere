import { roleAxis } from './role/RoleAxis.js';
import { lifecycleAxis } from './lifecycle/LifecycleAxis.js';
import { boundaryAxis } from './boundary/BoundaryAxis.js';
import type { JsonSchema } from '../lib/JsonSchema.js';
import type { ValidationError } from '../lib/ValidationError.js';
import type { Resolver } from './Resolver.js';

export interface Axis<Declared = unknown, Wire = unknown> {
  readonly slot: 'role' | 'lifecycle' | 'boundary';

  readonly format: JsonSchema;

  /** What a format cannot state: `role.relation.to` is a function, and JSON holds none. */
  refusals?(value: unknown): ValidationError[];

  describe(value: Declared, key: string): Wire | undefined;

  reconstruct(wire: Wire, resolve?: Resolver): Declared;
}

export const EXTENSION_AXES: readonly Axis[] = [
  roleAxis,
  lifecycleAxis,
  boundaryAxis,
];

/** The slots they occupy: the keys of `x-fougere` on a field descriptor. */
export const EXTENSION_SLOTS = EXTENSION_AXES.map((axis) => axis.slot);
