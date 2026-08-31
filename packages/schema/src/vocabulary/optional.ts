import { vocabulary } from './vocabulary.js';
import { Anatomy } from '../schema/axis/shape/Shape.js';
import { type Field } from '../schema/fields/Field.js';

export const optional: <T>(field: Field<T>) => Field<T | null> = vocabulary(
  'optional',
  (field) => ({
    shape: Anatomy.nullable(field.shape),
    ...(field.lifecycle?.create === undefined
      ? { lifecycle: { create: 'optional' as const } }
      : {}),
  }),
);
