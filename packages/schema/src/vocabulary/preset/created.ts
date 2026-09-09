import { Field } from '../../field/Field.js';
import { date } from '../primitive/date.js';

export function created(): Field<Date> {
  return date().with({
    lifecycle: { create: 'now', update: 'forbidden' },
  });
}
