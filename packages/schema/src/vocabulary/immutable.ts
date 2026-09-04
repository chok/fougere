import { vocabulary } from './vocabulary.js';
import { Field } from '../field/Field.js';

/**
 * So a write-once field is refused on a patch by the judge, not by the table.
 * FR : pour qu'un champ écrit une fois soit refusé par le juge sur une modification.
 * `immutable(text())` → `update: 'forbidden'`
 */
export const immutable: <T>(field: Field<T>) => Field<T> = vocabulary(
  'immutable',
  () => ({
    lifecycle: { update: 'forbidden' },
  }),
);
