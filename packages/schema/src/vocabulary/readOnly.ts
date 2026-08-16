import { vocabulary } from './vocabulary.js';
import { Boundary, Field } from '../field/index.js';

/**
 * Close the INBOUND direction — emitted normally, never accepted from a client. Supplying
 * it is a "Read-only" error; its absence is never "Required". Outbound is untouched.
 */
export const readOnly: <T>(field: Field<T>) => Field<T> = vocabulary('readOnly', (field) => ({
  boundary: Boundary.declared(field).with({ in: 'closed' }),
}));
