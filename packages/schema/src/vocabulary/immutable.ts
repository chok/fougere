import { Field } from '../field/index.js';

/**
 * Forbid re-writing after creation — `update: 'forbidden'` on the lifecycle
 * axis. Creation is untouched; supplying the field in a patch is a validation
 * error ("Immutable"). Derived views (`partial()`) keep the field for
 * introspection — the lifecycle rule, not the view, is what rejects it.
 */
export function immutable<T>(field: Field<T>): Field<T> {
  return field.with({ lifecycle: { ...field.lifecycle, update: 'forbidden' } });
}
