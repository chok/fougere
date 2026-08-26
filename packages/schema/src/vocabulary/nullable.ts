import { vocabulary } from './vocabulary.js';
import { Anatomy } from '../axis/shape/Shape.js';
import { type Field } from '../fields/Field.js';

export const nullable: <T>(field: Field<T>) => Field<T | null> = vocabulary('nullable', (field) => ({
  shape: Anatomy.nullable(field.shape),
}));
