import { Field, type Fields } from "./field/index.js";
import { Judge } from './validation/index.js';
import { projectUniqueOntoFields, type EntityDeclarations } from "./unique.js";
import { Schema, type SchemaConstructor } from "./schema/index.js";

/**
 * Define an entity — the factory that produces a schema-carrying class.
 *
 * ```ts
 * class Post extends entity({ id: primary(), title: text({ min: 1 }) }) {}
 *
 * new Post({ id, title })   // a real instance, data-typed
 * Post.pick('title')        // a derived view, same static API
 * function publish(p: Post) // `Post` IS the data type
 * ```
 *
 * Data and schema metadata only — no business behaviour lives on an entity. The 2nd
 * argument carries what the entity states about itself: `unique` groups, and per-adapter
 * hints for what a neutral field cannot express.
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
 * A declared default must satisfy its own shape — checked once, here, because the value is
 * static and so is the shape. `applyCreate` writes it into every row without passing the
 * client judge (rightly: it comes from the author, not the caller), so
 * `text({ min: 5, default: 'ab' })` used to produce rows the entity's own `validate`
 * refuses — silently, or as a driver error three layers away.
 */
function assertDefaultsAreValid(fields: Fields): void {
  for (const [name, field] of Object.entries(fields)) {
    const create = field.lifecycle?.create;
    if (typeof create !== 'object' || create === null || !('value' in create)) continue;

    const checked = Judge.value(field, (create as { value: unknown }).value);
    if ('error' in checked) {
      throw new Error(
        `Field '${name}': the declared default ${JSON.stringify((create as { value: unknown }).value)} `
        + `is not a legal value for it — ${checked.error}. It would be written into every row `
        + `without passing the judge.`,
      );
    }
  }
}
