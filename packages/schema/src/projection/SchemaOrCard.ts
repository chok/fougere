import type { Fields } from '../field/Field.js';
import type { SchemaView } from '../SchemaView.js';
import type { SchemaDescriptor } from './card/Descriptor.js';
import { Card } from './card/Card.js';

export type SchemaOrCard = SchemaView | SchemaDescriptor;

/**
 * So a card and a class are told apart by form, since a card has no method to call.
 * FR : pour qu'une carte et une classe se distinguent par la forme.
 * `isDescriptor({ name: 'Post', fields: {} })` → `true`
 */
function isDescriptor(source: SchemaOrCard): source is SchemaDescriptor {
  return typeof (source as SchemaView).getFields !== 'function';
}

/**
 * So a reader accepts a card from another process exactly where it accepts a local class.
 * FR : pour qu'une carte d'un autre processus passe là où passe une classe.
 * `schemaOf(cardFromTheWire).getFields()` → the same shape as a local `Post.getFields()`
 */
export function schemaOf(source: SchemaOrCard): SchemaView {
  return isDescriptor(source) ? Card.fromDescriptor(source).toSchema() : source;
}

/**
 * So the commonest question skips the intermediate schema a caller would otherwise hold.
 * FR : pour que la question fréquente évite le schéma intermédiaire.
 * `fieldsOf(card)` → `{ id: Field, title: Field }`
 */
export function fieldsOf(source: SchemaOrCard): Fields {
  return schemaOf(source).getFields();
}
