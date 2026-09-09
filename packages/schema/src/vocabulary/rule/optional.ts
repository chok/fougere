import { vocabulary } from '../vocabulary.js';
import { Shapes } from '../../axis/shape/Shape.js';
import { type Field } from '../../field/Field.js';

/**
 * Adds `null` AND permits absence. A field that already states a `create` rule keeps it.
 * FR : ajoute `null` ET permet l'absence. Un champ qui énonce déjà un `create` le garde.
 * `optional(text())` → `{ type: ['string', 'null'] }` and `create: 'optional'`
 */
export const optional: <T>(field: Field<T>) => Field<T | null> = vocabulary(
  'optional',
  (field) => ({
    shape: Shapes.nullable(field.shape),
    ...(field.lifecycle?.create === undefined
      ? { lifecycle: { create: 'optional' as const } }
      : {}),
  }),
);
