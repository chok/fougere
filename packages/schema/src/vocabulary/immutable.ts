import { vocabulary } from './vocabulary.js';
import { Field } from '../schema/fields/Field.js';

export const immutable: <T>(field: Field<T>) => Field<T> = vocabulary(
  'immutable',
  () => ({
    lifecycle: { update: 'forbidden' },
  }),
);
