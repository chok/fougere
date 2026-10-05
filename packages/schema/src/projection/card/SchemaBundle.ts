import type { SchemaDescriptor } from './SchemaDescriptor.js';
import type { Envelope } from './Envelope.js';

export interface SchemaBundle extends Envelope {
  $defs: Record<string, SchemaDescriptor>;
}
