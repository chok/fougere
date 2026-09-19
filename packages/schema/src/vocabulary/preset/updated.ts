import { Field, type Described } from '../../field/Field.js';
import { created } from './created.js';

export function updated(opts?: Described): Field<Date> {
  const base = created(opts);

  return base.with({ lifecycle: { ...base.lifecycle, update: 'now' } });
}
