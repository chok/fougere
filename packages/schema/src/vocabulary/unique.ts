import { vocabulary } from './vocabulary.js';
import { Field } from '../schema/fields/Field.js';
import { Unique } from '../schema/fields/constraint/Unique.js';

/**
 * So a single-field group needs no name: the key it sits under resolves it.
 * FR : pour qu'un groupe d'un champ n'ait pas besoin de nom : sa clé le résout.
 * `unique(email)` under the key `email` → the group `['email']`
 */
export const unique: <T>(field: Field<T>) => Field<T> = vocabulary('unique', (field) => ({
  role: { rules: [...(field.role?.rules ?? []), new Unique([])] },
}));
