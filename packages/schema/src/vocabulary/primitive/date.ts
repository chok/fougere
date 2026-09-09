import { Field } from '../../field/Field.js';

/**
 * A `Date` in a handler, an ISO string on the wire — the `isoDate` boundary converts.
 * FR : un `Date` dans un handler, une chaîne ISO sur le fil — `isoDate` convertit.
 * `date()` → `{ type: 'string', format: 'date-time' }`
 */
export function date(): Field<Date> {
  return new Field<Date>({ shape: { type: 'string', format: 'date-time' } });
}
