import { vocabulary } from '../vocabulary.js';
import { Shapes } from '../../axis/shape/Shape.js';
import { type Field } from '../../field/Field.js';

/** Admits `null` and absence, and keeps a `create` rule already stated. */
export const optional: <T>(field: Field<T>) => Field<T | null> = vocabulary(
  'optional',
  (field) => ({
    shape: Shapes.nullable(field.shape),
    ...(field.lifecycle?.create === undefined
      ? { lifecycle: { create: 'optional' as const } }
      : {}),
  }),
);
