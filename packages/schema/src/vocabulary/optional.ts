import { vocabulary } from './vocabulary.js';
import { Anatomy } from '../axis/shape/Shape.js';
import { type Field } from '../Field.js';

/**
 * Make a field nullable AND omissible at creation — `null` enters the shape's
 * grammar (the `[T,'null']` union) and the lifecycle permits absence. The two
 * moves are independent: for null-legal-but-still-required, use `nullable()`.
 * An existing create rule already answers absence, and with a value rather than an
 * omission — so `optional` adds nothing to it and states nothing.
 */
export const optional: <T>(field: Field<T>) => Field<T | null> = vocabulary('optional', (field) => ({
  shape: Anatomy.nullable(field.shape),
  // `'optional'` is the WEAKEST create rule: it says absence is legal, and every other rule
  // says that AND what fills the hole. So it states nothing when one is already there —
  // `optional(text({ default: 'draft' }))` is not a contradiction, it is a refinement.
  ...(field.lifecycle?.create === undefined ? { lifecycle: { create: 'optional' as const } } : {}),
}));
