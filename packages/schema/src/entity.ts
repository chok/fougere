import { Field, assertDefaultsAreValid, type Fields } from "./field/index.js";
import { projectUniqueOntoFields, type EntityDeclarations } from "./unique.js";
import { Schema, type SchemaConstructor } from "./schema/index.js";

/**
 * Define an entity — the factory that produces a schema-carrying class.
 *
 * ```ts
 * class Post extends entity({ id: primary(), title: text({ min: 1 }) }) {}
 *
 * new Post({ id, title })   // real instance, data-typed (NOT a bag of Fields)
 * Post.getFields()          // metadata, no instantiation
 * Post.pick('title')        // derived view, same static API
 * function publish(p: Post) // `Post` IS the data type — no Infer needed
 * ```
 *
 * The class carries data + schema metadata only. No business behaviour lives on
 * an entity — that belongs to handlers/commands (keeps form and behaviour apart).
 *
 * An optional 2nd argument carries per-consumer hints (see {@link Hints}) for the
 * irreducible bits a neutral field can't express — only adapters present in the
 * compilation are accepted; the field declarations themselves stay adapter-blind.
 */
export function entity<TFields extends Fields>(
  fields: TFields,
  declarations?: EntityDeclarations<TFields>,
): SchemaConstructor<TFields> {
  // THE door: the constructor judges each entry; the key travels so it can be named.
  const own = {} as Record<string, Field>;
  for (const [key, field] of Object.entries(fields)) own[key] = new Field(field, key);
  // The only place knowing both the keys and the declarations, so the composite group
  // becomes readable on each member's role. `getUnique()` still answers the declaration.
  const projected = projectUniqueOntoFields(own as TFields, declarations?.unique);
  assertDefaultsAreValid(projected);
  return Schema.of(projected, undefined, declarations?.hints, {}, declarations?.unique);
}
