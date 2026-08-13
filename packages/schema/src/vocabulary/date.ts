import { Field } from '../field/index.js';

export function date(): Field<Date> {
  return new Field<Date>({ shape: { type: 'string', format: 'date-time' } });
}
