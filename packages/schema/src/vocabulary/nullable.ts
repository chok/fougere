import { vocabulary } from './vocabulary.js';
import { Anatomy } from '../schema/axis/shape/Shape.js';
import { type Field } from '../schema/fields/Field.js';

export const nullable: <T>(field: Field<T>) => Field<T | null> = vocabulary(
  'nullable',
  (field) => ({
    shape: Anatomy.nullable(field.shape),
  }),
);
