import type { Axis } from '../Axis.js';
import type { ValidationError } from '../../validation.js';
import { admitWire, oneOfTokens } from '../../projection/card/admission.js';
import { isObject, shown } from '../../lib/utils.js';
import { CREATE_TOKENS, UPDATE_TOKENS, type LifecycleRules } from './Lifecycle.js';

export const lifecycleAxis: Axis<LifecycleRules, LifecycleRules> = {
  slot: 'lifecycle',

  validator(value, errors) {
    if (!isObject(value)) {
      errors.push({ path: 'lifecycle', message: `Expected an object — got ${shown(value)}` });
      return;
    }
    if (value.create !== undefined) validateCreate(value.create, errors);
    if (value.update !== undefined && !oneOfTokens(value.update, UPDATE_TOKENS)) {
      errors.push({
        path: 'lifecycle.update',
        message: `Expected 'now' or 'forbidden' — got ${shown(value.update)}`,
      });
    }
  },

  describe: (value) => value,
  reconstruct: (wire) => {
    admitWire(lifecycleAxis.validator, wire, 'lifecycle');
    return wire;
  },
};

/**
 * Judges the create rule, whose four legal forms are stated here and nowhere else.
 * FR : juge la règle de création, dont les quatre formes légales sont énoncées ici seulement.
 * `create: 3` → `Expected 'now', 'optional', { value } or { generate } — got 3`
 */
function validateCreate(rule: unknown, errors: ValidationError[]): void {
  if (oneOfTokens(rule, CREATE_TOKENS)) return;
  if (isObject(rule)) {
    if ('value' in rule) return;
    if ('generate' in rule) {
      if (typeof rule.generate !== 'string') {
        errors.push({
          path: 'lifecycle.create.generate',
          message: `Expected a generator name — got ${shown(rule.generate)}`,
        });
      }
      return;
    }
  }
  errors.push({
    path: 'lifecycle.create',
    message: `Expected 'now', 'optional', { value } or { generate } — got ${shown(rule)}`,
  });
}
