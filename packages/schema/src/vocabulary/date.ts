import { createField, type Field } from '../field/index.js';

export function date(): Field<Date> {
  return createField<Date>({ shape: { type: 'string', format: 'date-time' } });
}
