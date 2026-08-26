import { type Fields } from "./fields/Field.js";
import { FieldSet } from "./fields/FieldSet.js";
import { type EntityDeclarations } from "./EntityDeclarations.js";
import { Schema, type SchemaConstructor } from "./schema/Schema.js";

export function entity<TFields extends Fields>(
  originalFields: TFields,
  { unique, hints, previous }: EntityDeclarations<TFields> = {},
): SchemaConstructor<TFields> {
  return Schema.of({
    fields: FieldSet.declared(originalFields, unique),
    hints,
    previous,
  });
}
