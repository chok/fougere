import { vocabulary } from '../vocabulary.js';
import { Shapes } from '../../axis/shape/Shape.js';
import { type Field } from '../../field/Field.js';

/** Admits `null`; the field stays required. */
export const nullable: <T>(field: Field<T>) => Field<T | null> = vocabulary(
  'nullable',
  (field) => ({
    shape: Shapes.nullable(field.shape),
  }),
);
