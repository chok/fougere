import type { SchemaDescriptor } from './SchemaDescriptor.js';

export interface SchemaBundle {
  $defs: Record<string, SchemaDescriptor>;
  'x-fougere-version': 1;
  'x-fougere-vendor': 'fougere';
}
