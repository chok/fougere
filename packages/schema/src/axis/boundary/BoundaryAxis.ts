import type { Axis } from '../Axis.js';
import { BOUNDARY_FORMAT, type BoundaryRef } from './BoundaryRef.js';

export const boundaryAxis: Axis<BoundaryRef, BoundaryRef> = {
  slot: 'boundary',
  format: BOUNDARY_FORMAT,

  describe: (value) => value,
  reconstruct: (wire) => wire,
};
