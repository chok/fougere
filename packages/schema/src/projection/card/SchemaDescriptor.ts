import type { FieldDescriptor } from './FieldDescriptor.js';
import type { DerivedFrom } from './DerivedFrom.js';

export interface SchemaDescriptor {
  title?: string;
  type: 'object';
  properties: Record<string, FieldDescriptor>;
  required?: string[];
  'x-fougere-derived'?: DerivedFrom;
  'x-fougere-version': 1;
  'x-fougere-vendor': 'fougere';
}
