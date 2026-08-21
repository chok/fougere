import { vocabulary } from './vocabulary.js';
import { Boundary } from '../axis/boundary/Boundary.js';
import { Field } from '../Field.js';

export const writeOnly: <T>(field: Field<T>) => Field<T> = vocabulary('writeOnly', (field) => ({
  boundary: Boundary.declared(field).with({ out: 'closed' }),
}));
