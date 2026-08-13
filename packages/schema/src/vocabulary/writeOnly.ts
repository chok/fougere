import { Field, declaredBoundary } from '../field/index.js';

/**
 * Close the field's OUTBOUND direction — accepted at create/patch, never
 * emitted (the canonical password). `encodeFields` omits it and the adapters
 * exclude it from their output types. The inbound direction (and its
 * conversion) is untouched.
 */
export function writeOnly<T, A extends boolean>(field: Field<T, A>): Field<T, A> {
  return field.with({ boundary: { ...declaredBoundary(field), out: 'closed' } });
}
