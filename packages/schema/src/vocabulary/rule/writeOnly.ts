import { vocabulary } from '../vocabulary.js';
import { Boundary } from '../../axis/boundary/Boundary.js';
import { Field } from '../../field/Field.js';

/**
 * `writeOnly(text())` → `boundary.out` is `'closed'`
 */
export const writeOnly: <T>(field: Field<T>) => Field<T> = vocabulary(
  'writeOnly',
  (field) => ({
    boundary: Boundary.declared(field).declaring({ out: 'closed' }),
  }),
);
