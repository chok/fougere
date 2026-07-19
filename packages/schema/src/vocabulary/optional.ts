import { cloneField, nullableShape, type Field } from '../field/index.js';

/**
 * Make a field nullable AND omissible at creation — `null` enters the shape's
 * grammar (the `[T,'null']` union) and the lifecycle permits absence. The two
 * moves are independent: for null-legal-but-still-required, use `nullable()`.
 * An existing create rule (a default) wins over `'optional'` — it already
 * answers absence, and with a value rather than an omission.
 */
export function optional<T>(field: Field<T>): Field<T | null, true> {
  return cloneField(field, {
    shape: field.shape && nullableShape(field.shape),
    lifecycle: { ...field.lifecycle, create: field.lifecycle?.create ?? 'optional' },
  }) as Field<T | null, true>;
}
