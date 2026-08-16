import type { Axis } from '../axis.js';
import type { ValidationError } from '../../validation/result.js';
import { isObject, oneOfTokens } from '../../validation/form.js';
import { CREATE_TOKENS, UPDATE_TOKENS, type LifecycleRules } from './lifecycle.js';

/**
 * Who writes the value, and when. Its normal forms are named tokens and plain JSON, so both
 * projections are the identity — the axis travels verbatim and reads back verbatim.
 */
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
  reconstruct: (wire) => wire,
};

/** A create rule is a token, or one of two single-key objects. Nothing else is a rule. */
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
