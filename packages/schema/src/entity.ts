import { Field, type Fields } from './Field.js';
import { FieldGroup } from './constraint/FieldGroup.js';
import { Unique } from './constraint/Unique.js';
import { type EntityDeclarations } from './EntityDeclarations.js';
import { Schema, type SchemaConstructor } from './Schema.js';

/**
 * Builds the class an entity extends. The first argument becomes its schema; `declarations` states
 * what the entity says about itself — `unique` groups and per-adapter `hints`.
 *
 * ```ts
 * class Post extends entity(
 *   { id: primary(), slug: text(), title: text({ min: 1 }) },
 *   { unique: [['slug']] },
 * ) {}
 *
 * new Post({ slug: 'a', title: 'A' })    // → a Post; `Post` IS the data type
 * Post.validate({ slug: 'a', title: '' })
 * //   → { success: false,
 * //       errors: [{ path: 'title', message: 'String is too short (0 < 1).' }] }
 * Post.getFields()                       // → { id: Field, slug: Field, title: Field }
 * Post.pick('title')                     // → a one-field class, same static API
 * ```
 *
 * Data and schema metadata only — no business behaviour lives on an entity.
 */
export function entity<TFields extends Fields>(
  originalFields: TFields,
  declarations?: EntityDeclarations<TFields>,
): SchemaConstructor<TFields> {
  let fields: Fields = {};

  for (const [key, field] of Object.entries(originalFields))
    fields[key] = new Field(field, key);

  for (const group of declarations?.unique ?? [])
    fields = Unique.of(...group).onto(fields);

  fields = FieldGroup.resolveSelf(fields);

  return Schema.of(fields as TFields, undefined, declarations?.hints, {});
}
