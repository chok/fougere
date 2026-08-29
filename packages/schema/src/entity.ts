import { type Fields } from './fields/Field.js';
import { type EntityDeclarations } from './EntityDeclarations.js';
import { Schema, type SchemaConstructor } from './schema/Schema.js';

/**
 * A schema and what it states about itself, at the declaration site. The second argument
 * is `declares()` written where the fields are — the same fold, refusing the same things.
 */
export function entity<TFields extends Fields>(
  originalFields: TFields,
  declarations: EntityDeclarations<TFields> = {},
): SchemaConstructor<TFields> {
  return Schema.of({ fields: originalFields }).declares(declarations);
}
