import { vocabulary } from '../vocabulary.js';
import { Boundary } from '../../axis/boundary/Boundary.js';
import { Field } from '../../field/Field.js';

/**
 * Closes the way out, the dual of `readOnly`: the value is written and never sent back.
 * FR : ferme la sortie, dual de `readOnly` : la valeur s'écrit et ne repart jamais.
 * `writeOnly(text())` → `boundary.out` is `'closed'`
 */
export const writeOnly: <T>(field: Field<T>) => Field<T> = vocabulary(
  'writeOnly',
  (field) => ({
    boundary: Boundary.declared(field).declaring({ out: 'closed' }),
  }),
);
