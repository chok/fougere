import type { Axis } from '../Axis.js';
import type { ValidationError } from '../../../judge/result.js';
import { admitWire, oneOfTokens } from '../../../projection/card/admission.js';
import { isObject } from '../../../utils.js';
import { CREATE_TOKENS, UPDATE_TOKENS, type LifecycleRules } from './Lifecycle.js';

export const lifecycleAxis: Axis<LifecycleRules, LifecycleRules> = {
  slot: 'lifecycle',

  /**
   * So a lifecycle that is not one is refused with the half that failed named.
   * FR : pour qu'un cycle de vie fautif soit refusé en nommant la moitié en cause.
   * `lifecycle: { update: 'maybe' }` → one error on `lifecycle.update`
   */
  judge(value, errors) {
    if (!isObject(value)) {
      errors.push({ path: 'lifecycle', message: `Expected an object — got ${JSON.stringify(value)}` });
      return;
    }
    if (value.create !== undefined) judgeCreate(value.create, errors);
    if (value.update !== undefined && !oneOfTokens(value.update, UPDATE_TOKENS)) {
      errors.push({
        path: 'lifecycle.update',
        message: `Expected 'now' or 'forbidden' — got ${JSON.stringify(value.update)}`,
      });
    }
  },

  /**
   * So the lifecycle travels exactly as declared — it holds no function, only tokens and names.
   * FR : pour qu'il voyage tel que déclaré : des jetons et des noms, aucune fonction.
   * `{ create: { generate: 'cuid2' } }` → itself
   */
  describe: (value) => value,
  /**
   * So a lifecycle read off a card passes the same judge as a hand-written one.
   * FR : pour qu'un cycle de vie lu sur une carte passe le juge des autres.
   * `{ create: 'maybe' }` from a card → refused at admission
   */
  reconstruct: (wire) => {
    admitWire(lifecycleAxis.judge, wire, 'lifecycle');
    return wire;
  },
};

/**
 * So the four legal ways to declare a creation are stated once, and anything else names them.
 * FR : pour que les quatre façons de déclarer une création soient dites une fois.
 * `create: 3` → `Expected 'now', 'optional', { value } or { generate } — got 3`
 */
function judgeCreate(rule: unknown, errors: ValidationError[]): void {
  if (oneOfTokens(rule, CREATE_TOKENS)) return;
  if (isObject(rule)) {
    if ('value' in rule) return;
    if ('generate' in rule) {
      if (typeof rule.generate !== 'string') {
        errors.push({
          path: 'lifecycle.create.generate',
          message: `Expected a generator name — got ${JSON.stringify(rule.generate)}`,
        });
      }
      return;
    }
  }
  errors.push({
    path: 'lifecycle.create',
    message: `Expected 'now', 'optional', { value } or { generate } — got ${JSON.stringify(rule)}`,
  });
}
