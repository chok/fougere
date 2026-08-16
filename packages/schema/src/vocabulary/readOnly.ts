import { Boundary, Field } from '../field/index.js';

/**
 * Close the INBOUND direction — emitted normally, never accepted from a client. Supplying
 * it is a "Read-only" error; its absence is never "Required". Outbound is untouched.
 */
export function readOnly<T>(field: Field<T>): Field<T> {
  return field.with({ boundary: Boundary.declared(field).with({ in: 'closed' }) });
}
