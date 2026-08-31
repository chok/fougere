import type { Fields } from '../schema/fields/Field.js';
import type { SchemaView } from '../schema/SchemaView.js';
import type { SchemaDescriptor } from './card/Descriptor.js';
import { Card } from './card/Card.js';

export type SchemaOrCard = SchemaView | SchemaDescriptor;

function isDescriptor(source: SchemaOrCard): source is SchemaDescriptor {
  return typeof (source as SchemaView).getFields !== 'function';
}

export function schemaOf(source: SchemaOrCard): SchemaView {
  return isDescriptor(source) ? Card.fromDescriptor(source).toSchema() : source;
}

export function fieldsOf(source: SchemaOrCard): Fields {
  return schemaOf(source).getFields();
}
