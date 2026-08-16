import { Field, type Fields } from './Field.js';
import { FieldGroup } from './axis/role/FieldGroup.js';
import { Unique } from './axis/role/Unique.js';
import { type EntityDeclarations } from './EntityDeclarations.js';
import { Schema, type SchemaConstructor } from './Schema.js';

/**
 * Builds the class an entity extends. `fields` becomes its schema; `declarations` states
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
  fields: TFields,
  declarations?: EntityDeclarations<TFields>,
): SchemaConstructor<TFields> {
  const own: Record<string, Field> = {};

  for (const [key, field] of Object.entries(fields))
    own[key] = new Field(field, key);

  // The declarations are syntax: realized onto the fields here, never kept beside them.
  let realized: Fields = own;
  for (const group of declarations?.unique ?? [])
    realized = Unique.of(...group).onto(realized);
  realized = FieldGroup.resolveSelf(realized);

  return Schema.of(realized as TFields, undefined, declarations?.hints, {});
}

