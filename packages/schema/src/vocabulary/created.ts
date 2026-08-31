import { Field } from '../schema/fields/Field.js';
import { date } from './date.js';

export function created(): Field<Date> {
  return date().with({
    lifecycle: { create: 'now', update: 'forbidden' },
  });
}
