import { Field } from '../field/Field.js';

/**
 * So a date is a string on the wire and a `Date` in a handler, with no word said.
 * FR : pour qu'une date soit une chaîne sur le fil et une `Date` dans un handler.
 * `date()` → `{ type: 'string', format: 'date-time' }`, decoded by the `isoDate` boundary
 */
export function date(): Field<Date> {
  return new Field<Date>({ shape: { type: 'string', format: 'date-time' } });
}
