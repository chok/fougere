import type { JSONSchema7TypeName } from 'json-schema';

/** A shape's type, with `date` and `choice` told apart from `string`. */
export type ShapeType =
  | Exclude<JSONSchema7TypeName, 'null' | 'string'>
  | 'text'
  | 'date'
  | 'choice';
