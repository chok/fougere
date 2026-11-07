import { word } from '../../field/Word.js';

/** A `Date` in code, an ISO string on the wire. */
export const date = word<Date>()('date', { type: 'string', format: 'date-time' }, {});
