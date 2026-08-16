import { vocabulary } from './vocabulary.js';
import { Boundary, Field } from '../field/index.js';

/**
 * Close the OUTBOUND direction — accepted at create/patch, never emitted (the canonical
 * password). `encodeFields` omits it. Inbound is untouched.
 */
export const writeOnly: <T>(field: Field<T>) => Field<T> = vocabulary('writeOnly', (field) => ({
  boundary: Boundary.declared(field).with({ out: 'closed' }),
}));
