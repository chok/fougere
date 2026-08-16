import { Boundary, Field } from '../field/index.js';

/**
 * Close the OUTBOUND direction — accepted at create/patch, never emitted (the canonical
 * password). `encodeFields` omits it. Inbound is untouched.
 */
export function writeOnly<T>(field: Field<T>): Field<T> {
  return field.with({ boundary: Boundary.declared(field).with({ out: 'closed' }) });
}
