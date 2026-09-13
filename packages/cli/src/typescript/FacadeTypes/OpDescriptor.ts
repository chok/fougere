import type { SchemaDescriptor } from '@fougere/schema';

export interface OpDescriptor {
  name: string;
  description?: string;
  output?: SchemaDescriptor;
  cardinality?: 'one' | 'maybe' | 'many' | 'page' | 'none';
}
