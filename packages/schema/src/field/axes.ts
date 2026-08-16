import type { Axis } from './axis.js';
import { roleAxis } from './role/axis.js';
import { lifecycleAxis } from './lifecycle/axis.js';
import { boundaryAxis } from './boundary/axis.js';

/**
 * The three axes a card carries under `x-fougere`, in wire order. THE list — the judge, the
 * describer and the reconstructor all fold it, so a fourth extension axis is one file and
 * one entry here.
 *
 * `shape` is absent on purpose: it is the card's body, not an extension. So is `meta`, whose
 * only member maps to JSON Schema's own `description`.
 */
export const EXTENSION_AXES: readonly Axis<never, never>[] = [
  roleAxis,
  lifecycleAxis,
  boundaryAxis,
] as unknown as readonly Axis<never, never>[];
