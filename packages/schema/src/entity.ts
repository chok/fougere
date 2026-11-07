import { type Fields } from './field/Fields.js';
import { type EntityDeclarations } from './entity/EntityDeclarations.js';
import { Schema } from './Schema.js';
import { type SchemaConstructor } from './SchemaConstructor.js';

/**
 * Declares an entity: its fields, and what it states about them.
 * Ex: `class Post extends entity({ id: primary(), title: text() }) {}`.
 *
 * Documented: [entities](https://fougere.dev/docs/concepts/entity).
 */
export function entity<TFields extends Fields>(
  fields: TFields,
  declarations: EntityDeclarations<TFields> = {},
): SchemaConstructor<TFields> {
  return Schema.of({ fields }).declares(declarations);
}
