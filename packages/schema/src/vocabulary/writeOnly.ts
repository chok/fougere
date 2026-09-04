import { vocabulary } from './vocabulary.js';
import { Boundary } from '../axis/boundary/Boundary.js';
import { Field } from '../field/Field.js';

/**
 * So a secret leaves no response, the dual of `readOnly` on the same axis.
 * FR : pour qu'un secret ne reparte dans aucune réponse, dual de `readOnly`.
 * `writeOnly(text())` → `boundary.out` is `'closed'`
 */
export const writeOnly: <T>(field: Field<T>) => Field<T> = vocabulary(
  'writeOnly',
  (field) => ({
    boundary: Boundary.declared(field).with({ out: 'closed' }),
  }),
);
