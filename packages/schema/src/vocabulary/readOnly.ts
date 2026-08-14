import { Field, declaredBoundary } from '../field/index.js';

/**
 * Close the INBOUND direction — emitted normally, never accepted from a client. Supplying
 * it is a "Read-only" error; its absence is never "Required". Outbound is untouched.
 */
export function readOnly<T>(field: Field<T>): Field<T> {
  return field.with({ boundary: { ...declaredBoundary(field), in: 'closed' } });
}
