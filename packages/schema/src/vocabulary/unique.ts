import { Field } from '../field/index.js';

/**
 * No two rows may carry the same value — a unique constraint of one, on the role axis.
 *
 * The role axis is where it belongs because uniqueness is a fact about the field's
 * place in the entity, not about the values it accepts: `text({ max: 80 })` says what
 * a slug looks like, `unique(...)` says there is only one of each. A shape cannot
 * express it — judging a single value can never see the other rows.
 *
 * So the realization is the storage's, and only the storage's: the DDL emits the
 * constraint, the database enforces it on every write, including writes Fougere never
 * saw. A collision surfaces as the driver's error, not as a `validate()` failure.
 *
 * It also travels: `describe()` carries `role.unique` on the card, so a consumer in
 * another language reads the same promise — one that is now kept.
 *
 * The group is `[]` — the empty member list denoting THIS field, because a field does not
 * know its own key here: `slug` is named by the object literal `entity({...})` receives,
 * one call up. Keeping it empty rather than filling it in later means nothing to remap
 * when `rename()` moves the key, and one shape shared with the composite form.
 */
export function unique<T, A extends boolean>(field: Field<T, A>): Field<T, A> {
  return field.with({ role: { ...field.role, unique: [[]] } });
}
