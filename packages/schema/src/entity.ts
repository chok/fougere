import { type Fields } from './fields/Field.js';
import { type EntityDeclarations } from './EntityDeclarations.js';
import { Schema, type SchemaConstructor } from './schema/Schema.js';

export function entity<TFields extends Fields>(
  fields: TFields,
  declarations: EntityDeclarations<TFields> = {},
): SchemaConstructor<TFields> {
  return Schema.of({ fields }).declares(declarations);
}
