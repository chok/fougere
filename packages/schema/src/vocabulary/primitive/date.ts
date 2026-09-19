import { Field, type Shared } from '../../field/Field.js';

/**
 * A `Date` in a handler, an ISO string on the wire — the `isoDate` boundary converts.
 * `date()` → `{ type: 'string', format: 'date-time' }`
 */
export function date(opts?: Shared<Date>): Field<Date> {
  return new Field<Date>({ shape: { type: 'string', format: 'date-time' } }).setShared(
    opts,
  );
}
