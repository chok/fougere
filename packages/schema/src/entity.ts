import { type Fields } from './field/Fields.js';
import { type EntityDeclarations } from './entity/EntityDeclarations.js';
import { Schema } from './Schema.js';
import { type SchemaConstructor } from './SchemaConstructor.js';

/**
 * The one call everything derives from: the fields, and what the entity states about them.
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
