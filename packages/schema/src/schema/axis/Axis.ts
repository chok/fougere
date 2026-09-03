import { roleAxis } from './role/RoleAxis.js';
import { lifecycleAxis } from './lifecycle/LifecycleAxis.js';
import { boundaryAxis } from './boundary/BoundaryAxis.js';
import type { ValidationError } from '../../judge/result.js';

export interface Axis<Declared = unknown, Wire = unknown> {
  readonly slot: 'role' | 'lifecycle' | 'boundary';

  /**
   * So a bad declaration is refused where its axis is defined, never by a switch elsewhere.
   * FR : pour qu'une déclaration fautive soit refusée là où son axe est défini.
   * `role: 'nonsense'` → one error on `role`, pushed by the role axis itself
   */
  judge(value: unknown, errors: ValidationError[]): void;

  /**
   * So an axis writes itself onto a card, in a form another language can read.
   * FR : pour qu'un axe s'écrive sur une carte sous une forme lisible ailleurs.
   * `ref(User)` → `{ ref: 'User' }` under `x-fougere.role`
   */
  describe(value: Declared, key: string): Wire | undefined;

  /**
   * So a card read back gives the axis it came from, class references resolved by name.
   * FR : pour qu'une carte relue redonne l'axe, les classes résolues par leur nom.
   * `{ ref: 'User' }` with a resolver → `ref(User)`
   */
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
