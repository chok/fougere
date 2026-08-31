import { Field } from '../schema/fields/Field.js';

export function date(): Field<Date> {
  return new Field<Date>({ shape: { type: 'string', format: 'date-time' } });
}
