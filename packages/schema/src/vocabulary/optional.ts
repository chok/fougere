import { vocabulary } from './vocabulary.js';
import { Anatomy } from '../axis/shape/Shape.js';
import { type Field } from '../field/Field.js';

/**
 * So the two questions are settled at once: `null` is legal, and absence is too.
 * FR : pour que les deux questions soient réglées d'un coup : `null` légal, absence permise.
 * `optional(text())` → nullable shape and `create: 'optional'`
 */
export const optional: <T>(field: Field<T>) => Field<T | null> = vocabulary(
  'optional',
  (field) => ({
    shape: Anatomy.nullable(field.shape),
    ...(field.lifecycle?.create === undefined
      ? { lifecycle: { create: 'optional' as const } }
      : {}),
  }),
);
