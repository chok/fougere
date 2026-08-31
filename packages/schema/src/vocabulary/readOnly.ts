import { vocabulary } from './vocabulary.js';
import { Boundary } from '../schema/axis/boundary/Boundary.js';
import { Field } from '../schema/fields/Field.js';

export const readOnly: <T>(field: Field<T>) => Field<T> = vocabulary(
  'readOnly',
  (field) => ({
    boundary: Boundary.declared(field).with({ in: 'closed' }),
  }),
);
