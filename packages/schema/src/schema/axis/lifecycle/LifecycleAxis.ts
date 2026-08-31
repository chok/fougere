import type { Axis } from '../Axis.js';
import type { ValidationError } from '../../../judge/result.js';
import { admitWire } from '../../../projection/card/admission.js';
import { isObject, oneOfTokens } from '../../../judge/ValueForm.js';
import { CREATE_TOKENS, UPDATE_TOKENS, type LifecycleRules } from './Lifecycle.js';

export const lifecycleAxis: Axis<LifecycleRules, LifecycleRules> = {
  slot: 'lifecycle',

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

  describe: (value) => value,
  reconstruct: (wire) => {
    admitWire(lifecycleAxis.judge, wire, 'lifecycle');
    return wire;
  },
};

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
