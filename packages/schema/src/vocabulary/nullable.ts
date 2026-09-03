import { vocabulary } from './vocabulary.js';
import { Anatomy } from '../schema/axis/shape/Shape.js';
import { type Field } from '../schema/fields/Field.js';

/**
 * So `null` becomes a legal value, without touching whether the field is required.
 * FR : pour que `null` devienne légal, sans toucher au caractère obligatoire du champ.
 * `nullable(text())` → `{ type: ['string', 'null'] }`, still required at create
 */
export const nullable: <T>(field: Field<T>) => Field<T | null> = vocabulary(
  'nullable',
  (field) => ({
    shape: Anatomy.nullable(field.shape),
  }),
);
