import { vocabulary } from './vocabulary.js';
import { Field } from '../Field.js';

export const indexed: <T>(field: Field<T>) => Field<T> = vocabulary('indexed', () => ({ role: { index: true } }));
