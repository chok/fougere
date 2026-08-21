import type { Fields } from '../Field.js';
import type { SchemaView } from '../SchemaView.js';
import type { SchemaDescriptor } from '../card/Descriptor.js';
import { reconstruct } from '../card/reconstruct.js';

export type SchemaSource = SchemaView | SchemaDescriptor;

function isDescriptor(source: SchemaSource): source is SchemaDescriptor {
  return typeof (source as SchemaView).getFields !== 'function';
}

export function schemaOf(source: SchemaSource): SchemaView {
  return isDescriptor(source) ? reconstruct(source) : source;
}

export function fieldsOf(source: SchemaSource): Fields {
  return schemaOf(source).getFields();
}
