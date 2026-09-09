import { vocabulary } from '../vocabulary.js';
import { Shapes } from '../../axis/shape/Shape.js';
import { type Field } from '../../field/Field.js';

/**
 * Adds `null` and leaves the field REQUIRED — `optional()` is the one permitting absence.
 * FR : ajoute `null` en laissant le champ OBLIGATOIRE — `optional()` permet l'absence.
 * `nullable(text())` → `{ type: ['string', 'null'] }`, and `validate({})` still refuses
 */
export const nullable: <T>(field: Field<T>) => Field<T | null> = vocabulary(
  'nullable',
  (field) => ({
    shape: Shapes.nullable(field.shape),
  }),
);
