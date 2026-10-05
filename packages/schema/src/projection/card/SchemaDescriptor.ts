import type { FieldDescriptor } from './FieldDescriptor.js';
import type { DerivedFrom } from './DerivedFrom.js';
import type { Envelope } from './Envelope.js';

export interface SchemaDescriptor extends Envelope {
  title?: string;
  type: 'object';
  properties: Record<string, FieldDescriptor>;
  required?: string[];
  'x-fougere-derived'?: DerivedFrom;
}
