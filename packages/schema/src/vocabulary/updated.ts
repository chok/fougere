import { created } from './created.js';
import { Field } from '../schema/fields/Field.js';

/**
 * So the dual of `created()` is re-stamped at every write, by the same hand.
 * FR : pour que le dual de `created()` soit ré-estampé à chaque écriture, par la même main.
 * `updated()` → `create: 'now'`, `update: 'now'`
 */
export function updated(): Field<Date> {
  const base = created();
  return base.with({ lifecycle: { ...base.lifecycle, update: 'now' } });
}
