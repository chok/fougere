import { vocabulary } from './vocabulary.js';
import { Field } from '../field/Field.js';

/**
 * So the entity states the index, and the DDL is the one that emits it.
 * FR : pour que l'entité énonce l'index, le DDL étant celui qui l'émet.
 * `indexed(text())` → `role.index` is `true`
 */
export const indexed: <T>(field: Field<T>) => Field<T> = vocabulary('indexed', () => ({
  role: { index: true },
}));
