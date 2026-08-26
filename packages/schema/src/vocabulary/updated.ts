import { created } from './created.js';
import { Field } from '../fields/Field.js';

export function updated(): Field<Date> {
  const base = created();
  return base.with({ lifecycle: { ...base.lifecycle, update: 'now' } });
}
