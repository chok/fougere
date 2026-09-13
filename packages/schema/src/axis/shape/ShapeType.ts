import type { JSONSchema7TypeName } from 'json-schema';

/**
 * The standard's own list, less `null` — a shape states that as the `[T,'null']` union —
 * and with `string` in the three forms every projection here tells apart: a `date()`, a
 * bounded set, and everything else. Those three are the whole of what this package adds.
 */
export type ShapeType =
  | Exclude<JSONSchema7TypeName, 'null' | 'string'>
  | 'text'
  | 'date'
  | 'choice';
