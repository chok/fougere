import type { Axis } from '../axis.js';
import { isObject } from '../../validation/form.js';
import type { BoundaryRef } from './boundary.js';

/**
 * How and in which direction a value crosses the client frontier. Only the FORM is judged:
 * the codec registry is OPEN, so a name is resolved — and refused — by `Boundary.of`, the
 * one place that can know.
 *
 * `describe` carries only what was DECLARED: the shape-derived default (a date-time string
 * converts through isoDate) is re-derived on reconstruction. Convention over config, on the
 * wire too.
 */
export const boundaryAxis: Axis<BoundaryRef, BoundaryRef> = {
  slot: 'boundary',

  judge(value, errors) {
    if (typeof value === 'string') return; // an alias name; resolved, and refused, later
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
  reconstruct: (wire) => wire,
};
