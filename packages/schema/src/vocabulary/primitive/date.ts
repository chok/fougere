import { word } from '../../field/Word.js';

/**
 * A `Date` in a handler, an ISO string on the wire — the `isoDate` boundary converts.
 * `date()` → `{ type: 'string', format: 'date-time' }`
 */
export const date = word<Date>()('date', { type: 'string', format: 'date-time' }, {});
