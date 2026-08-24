import type { Axis } from '../Axis.js';
import { admitWire } from '../../card/admission.js';
import { isObject } from '../../judge/ValueForm.js';
import type { BoundaryRef } from './Boundary.js';

export const boundaryAxis: Axis<BoundaryRef, BoundaryRef> = {
  slot: 'boundary',

  judge(value, errors) {
    if (typeof value === 'string') return; 
    if (!isObject(value)) {
      errors.push({
        path: 'boundary',
        message: `Expected an alias name or { in, out } — got ${JSON.stringify(value)}`,
      });
      return;
    }
    for (const [side, verb] of [['in', 'decode'], ['out', 'encode']] as const) {
      const rule = value[side];
      if (rule === undefined || rule === 'closed') continue;
      if (!isObject(rule) || typeof rule[verb] !== 'string') {
        errors.push({ path: `boundary.${side}`, message: `Expected 'closed' or { ${verb}: <name> }` });
      }
    }
  },

  describe: (value) => value,
  reconstruct: (wire) => {
    admitWire(boundaryAxis.judge, wire, 'boundary');
    return wire;
  },
};
