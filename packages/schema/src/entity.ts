import { type Fields } from './schema/fields/Field.js';
import { type EntityDeclarations } from './entity/EntityDeclarations.js';
import { Schema, type SchemaConstructor } from './schema/Schema.js';

/**
 * So the whole framework starts from one call: fields, and what they say about themselves.
 * FR : pour que tout parte d'un appel : les champs, et ce qu'ils disent d'eux-mêmes.
 * `class Post extends entity({ id: primary(), title: text() }, { unique: [['title']] }) {}`
 */
export function entity<TFields extends Fields>(
  fields: TFields,
  declarations: EntityDeclarations<TFields> = {},
): SchemaConstructor<TFields> {
  return Schema.of({ fields }).declares(declarations);
}
