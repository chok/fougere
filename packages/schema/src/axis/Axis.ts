import { roleAxis } from './role/axis.js';
import { lifecycleAxis } from './lifecycle/axis.js';
import { boundaryAxis } from './boundary/axis.js';
import type { ValidationError } from '../judge/result.js';

export interface Axis<Declared = unknown, Wire = unknown> {
  readonly slot: 'role' | 'lifecycle' | 'boundary';

  judge(value: unknown, errors: ValidationError[]): void;

  describe(value: Declared, key: string): Wire | undefined;

  reconstruct(wire: Wire, resolve?: Resolver): Declared;
}

export type Resolver = (name: string) => (abstract new (...args: never[]) => unknown) | undefined;

export const EXTENSION_AXES: readonly Axis<never, never>[] = [
  roleAxis,
  lifecycleAxis,
  boundaryAxis,
] as unknown as readonly Axis<never, never>[];
