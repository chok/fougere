import { vocabulary } from '../vocabulary.js';
import { Field } from '../../field/Field.js';

export const unique: <T>(field: Field<T>) => Field<T> = vocabulary('unique', () => ({
  role: { unique: true },
}));
