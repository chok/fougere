import { vocabulary } from './vocabulary.js';
import { Field } from '../field/index.js';

/**
 * Forbid re-writing after creation — `update: 'forbidden'`. Creation is untouched;
 * supplying the field in a patch is an "Immutable" error. The rule rejects it, not the view.
 */
export const immutable: <T>(field: Field<T>) => Field<T> = vocabulary('immutable', () => ({
  lifecycle: { update: 'forbidden' },
}));
