import { vocabulary } from './vocabulary.js';
import { Anatomy } from '../axis/shape/Shape.js';
import { type Field } from '../Field.js';

export const optional: <T>(field: Field<T>) => Field<T | null> = vocabulary('optional', (field) => ({
  shape: Anatomy.nullable(field.shape),
  ...(field.lifecycle?.create === undefined ? { lifecycle: { create: 'optional' as const } } : {}),
}));
