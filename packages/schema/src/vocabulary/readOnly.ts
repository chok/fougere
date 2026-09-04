import { vocabulary } from './vocabulary.js';
import { Boundary } from '../axis/boundary/Boundary.js';
import { Field } from '../field/Field.js';

/**
 * So a field a client may read but never write says so once, on the field.
 * FR : pour qu'un champ lisible mais non écrivable le dise une fois, sur le champ.
 * `readOnly(text())` → `boundary.in` is `'closed'`, absent from every form
 */
export const readOnly: <T>(field: Field<T>) => Field<T> = vocabulary(
  'readOnly',
  (field) => ({
    boundary: Boundary.declared(field).with({ in: 'closed' }),
  }),
);
