import { Field, type Fields } from './Field.js';
import { Unique } from './constraint/Unique.js';
import { type EntityDeclarations } from './EntityDeclarations.js';
import { Schema, type SchemaConstructor } from './Schema.js';

export function entity<TFields extends Fields>(
  originalFields: TFields,
  declarations?: EntityDeclarations<TFields>,
): SchemaConstructor<TFields> {
  let fields: Fields = {};

  for (const [key, field] of Object.entries(originalFields))
    fields[key] = new Field(field, key);

  for (const group of declarations?.unique ?? [])
    fields = new Unique(group).onto(fields);

  return Schema.of({
    fields: fields as TFields,
    hints: declarations?.hints,
    previous: declarations?.previous,
  });
}
