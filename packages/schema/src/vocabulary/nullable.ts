import { Anatomy } from '../field/index.js';
import { type Field } from '../field/index.js';

/**
 * Make `null` a legal VALUE without touching presence — the missing quadrant, "nullable
 * but required". For null-legal AND omissible, use `optional()`.
 */
export function nullable<T>(field: Field<T>): Field<T | null> {
  return field.with<T | null>({ shape: Anatomy.nullable(field.shape) });
}
