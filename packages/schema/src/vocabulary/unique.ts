import { vocabulary } from './vocabulary.js';
import { Field } from '../schema/fields/Field.js';
import { Unique } from '../schema/fields/constraint/Unique.js';

export const unique: <T>(field: Field<T>) => Field<T> = vocabulary('unique', (field) => ({
  role: { rules: [...(field.role?.rules ?? []), new Unique([])] },
}));
