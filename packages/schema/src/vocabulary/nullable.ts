import { nullableShape, type Field } from '../field/index.js';

/**
 * Make `null` a legal VALUE without touching presence — the field stays required
 * at creation (the missing quadrant: "nullable but required"). The caller must
 * say something, and "nothing to report" (`null`) is an acceptable answer.
 * For null-legal-and-omissible, use `optional()`.
 */
export function nullable<T>(field: Field<T>): Field<T | null> {
  return field.with<T | null>({ shape: nullableShape(field.shape) });
}
