import { vocabulary } from '../vocabulary.js';
import { Boundary } from '../../axis/boundary/Boundary.js';
import { Field } from '../../field/Field.js';

/**
 * `readOnly(text())` → `boundary.in` is `'closed'`
 */
export const readOnly: <T>(field: Field<T>) => Field<T> = vocabulary(
  'readOnly',
  (field) => ({
    boundary: Boundary.declared(field).declaring({ in: 'closed' }),
  }),
);
