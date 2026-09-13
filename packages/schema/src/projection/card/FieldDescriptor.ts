import type { ShapeKeywords } from './ShapeKeywords.js';
import type { JSONSchema7TypeName } from 'json-schema';
import type { FieldExtension } from './FieldExtension.js';

export type FieldDescriptor = ShapeKeywords & {
  type?: JSONSchema7TypeName | JSONSchema7TypeName[];
  items?: FieldDescriptor;
  properties?: Record<string, FieldDescriptor>;
  description?: string;
  'x-fougere'?: FieldExtension;
};
