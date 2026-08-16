import { vocabulary } from './vocabulary.js';
import { Field, Unique } from '../field/index.js';

/**
 * No two rows carry the same value — a unique constraint of one, on the role axis.
 *
 * A shape cannot express it: judging one value never sees the other rows. So only the
 * storage realizes it, and a collision surfaces as the driver's error. It travels on the
 * card, so a consumer in another language reads the same promise.
 *
 * Its members are empty until `entity()` names the carrier — a field does not know its own
 * key. See {@link Unique}.
 */
export const unique: <T>(field: Field<T>) => Field<T> = vocabulary('unique', (field) => ({
  role: { rules: [...(field.role?.rules ?? []), Unique.self()] },
}));
