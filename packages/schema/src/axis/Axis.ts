import { roleAxis } from './role/RoleAxis.js';
import { lifecycleAxis } from './lifecycle/LifecycleAxis.js';
import { boundaryAxis } from './boundary/BoundaryAxis.js';
import type { ValidationError } from '../validation.js';

export interface Axis<Declared = unknown, Wire = unknown> {
  readonly slot: 'role' | 'lifecycle' | 'boundary';

  judge(value: unknown, errors: ValidationError[]): void;

  describe(value: Declared, key: string): Wire | undefined;

  reconstruct(wire: Wire, resolve?: Resolver): Declared;
}

export type Resolver = (name: string) => (abstract new (...args: never[]) => unknown) | undefined;

export const EXTENSION_AXES: readonly Axis[] = [
  roleAxis,
  lifecycleAxis,
  boundaryAxis,
];

/** The slots they occupy: the keys of `x-fougere` on a field descriptor. */
export const EXTENSION_SLOTS = EXTENSION_AXES.map((axis) => axis.slot);
