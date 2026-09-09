import { vocabulary } from '../vocabulary.js';
import { Boundary } from '../../axis/boundary/Boundary.js';
import { Field } from '../../field/Field.js';

/**
 * Closes the way in, so the field leaves `Visibility.input` and every form derived from it.
 * FR : ferme l'entrée : le champ quitte `Visibility.input` et tout formulaire qui en dérive.
 * `readOnly(text())` → `boundary.in` is `'closed'`
 */
export const readOnly: <T>(field: Field<T>) => Field<T> = vocabulary(
  'readOnly',
  (field) => ({
    boundary: Boundary.declared(field).declaring({ in: 'closed' }),
  }),
);
