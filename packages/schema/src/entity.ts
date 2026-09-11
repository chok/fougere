import { type Fields } from './field/Field.js';
import { type EntityDeclarations } from './entity/EntityDeclarations.js';
import { Schema, type SchemaConstructor } from './Schema.js';

/**
 * The one call everything derives from: the fields, and what the entity states about them.
 * FR : l'appel dont tout dérive : les champs, et ce que l'entité en dit.
 * `class Post extends entity({ id: primary(), title: text() }, { unique: [['title']] }) {}`
 *
 * Documented: [entities](https://fougere.dev/docs/schema/entities).
 */
export function entity<TFields extends Fields>(
  fields: TFields,
  declarations: EntityDeclarations<TFields> = {},
): SchemaConstructor<TFields> {
  return Schema.of({ fields }).declares(declarations);
}
