import { Field, type Fields } from "./field/index.js";
import { checkValue } from "./projections/check-value.js";
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

/**
 * A declared default must satisfy its own shape — checked once, here.
 *
 * `applyCreate` writes it into every row without passing the client judge, which is
 * correct: the judge asks "is what the CALLER sent legal", and this value comes from the
 * author. But that means `text({ min: 5, default: 'ab' })` produced rows the entity's own
 * `validate` refuses — silently on a store that judges nothing, as a constraint violation
 * on SQL, as a validator error on MongoDB. Three symptoms, one cause, none of them naming
 * it.
 *
 * The value is static and so is the shape, so the answer is static: it belongs at the
 * declaration, not on every write. `oneOf` closes its own case in the type system; this
 * catches what no type can — a bound, a pattern, a format.
 */
function assertDefaultsAreValid(fields: Fields): void {
  for (const [name, field] of Object.entries(fields)) {
    const create = field.lifecycle?.create;
    if (typeof create !== 'object' || create === null || !('value' in create)) continue;

    const checked = checkValue(field, (create as { value: unknown }).value);
    if ('error' in checked) {
      throw new Error(
        `Field '${name}': the declared default ${JSON.stringify((create as { value: unknown }).value)} `
        + `is not a legal value for it — ${checked.error}. It would be written into every row `
        + `without passing the judge.`,
      );
    }
  }
}
