import { Field } from '../field/index.js';

/**
 * Forbid re-writing after creation — `update: 'forbidden'`. Creation is untouched;
 * supplying the field in a patch is an "Immutable" error. The rule rejects it, not the view.
 */
export function immutable<T>(field: Field<T>): Field<T> {
  return field.with({ lifecycle: { ...field.lifecycle, update: 'forbidden' } });
}
