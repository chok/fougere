import { Field } from '../field/index.js';

/**
 * No two rows carry the same value — a unique constraint of one, on the role axis.
 *
 * A shape cannot express it: judging one value never sees the other rows. So only the
 * storage realizes it, and a collision surfaces as the driver's error. It travels on the
 * card, so a consumer in another language reads the same promise.
 *
 * The group is `[]` — the empty list denoting THIS field, which does not know its own key.
 * See the ⚠️ on the role axis.
 */
export function unique<T>(field: Field<T>): Field<T> {
  return field.with({ role: { ...field.role, unique: [[]] } });
}
