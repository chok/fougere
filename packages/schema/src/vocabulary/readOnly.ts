import { Field, declaredBoundary } from '../field/index.js';

/**
 * Close the field's INBOUND direction — emitted normally, never accepted from
 * a client (a server-owned field, e.g. a computed counter). Supplying it in a
 * create or patch input is a validation error ("Read-only"); its absence is
 * never "Required" (the server provides it). Input types exclude it.
 * The outbound direction (and its conversion) is untouched.
 */
export function readOnly<T, A extends boolean>(field: Field<T, A>): Field<T, A> {
  return field.with({ boundary: { ...declaredBoundary(field), in: 'closed' } });
}
