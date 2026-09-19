import { Field, type Described } from '../../field/Field.js';
import { date } from '../primitive/date.js';

export function created(opts?: Described): Field<Date> {
  return date(opts).with({
    lifecycle: { create: 'now', update: 'forbidden' },
  });
}
