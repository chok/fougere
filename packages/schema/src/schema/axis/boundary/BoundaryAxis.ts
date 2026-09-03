import type { Axis } from '../Axis.js';
import { admitWire } from '../../../projection/card/admission.js';
import { isObject } from '../../../utils.js';
import type { BoundaryRef } from './Boundary.js';

export const boundaryAxis: Axis<BoundaryRef, BoundaryRef> = {
  slot: 'boundary',

  /**
   * So a boundary that is neither an alias nor a legal pair is refused.
   * FR : pour qu'une frontière illégale soit refusée avec le côté en cause.
   * `boundary: { in: { decode: 3 } }` → one error on `boundary.in`
   */
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

  /**
   * So a boundary crosses as written: it names its codecs, never holds them.
   * FR : pour que la frontière passe telle quelle : elle nomme ses codecs, ne les porte pas.
   * `'isoDate'` → `'isoDate'`
   */
  describe: (value) => value,
  /**
   * So a card carrying a boundary is judged before anything trusts it.
   * FR : pour qu'une carte portant une frontière soit jugée avant d'être crue.
   * `{ in: 'oops' }` from a card → refused at admission
   */
  reconstruct: (wire) => {
    admitWire(boundaryAxis.judge, wire, 'boundary');
    return wire;
  },
};
