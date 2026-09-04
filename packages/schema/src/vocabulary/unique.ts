import { vocabulary } from './vocabulary.js';
import { Field } from '../field/Field.js';

/**
 * So a field is unique on its own, whatever key it ends up under.
 * FR : pour qu'un champ soit unique à lui seul, quelle que soit sa clé.
 * `unique(email)` → `role.unique` is true
 */
export const unique: <T>(field: Field<T>) => Field<T> = vocabulary('unique', () => ({
  role: { unique: true },
}));
