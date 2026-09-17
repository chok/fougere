import type { Axis } from '../Axis.js';
import { LIFECYCLE_FORMAT, type LifecycleRules } from './LifecycleRules.js';

export const lifecycleAxis: Axis<LifecycleRules, LifecycleRules> = {
  slot: 'lifecycle',
  format: LIFECYCLE_FORMAT,

  describe: (value) => value,
  reconstruct: (wire) => wire,
};
