import { createField, type Field, type SchemaLike } from '../field/index.js';
import { describe } from '../projections/describe.js';
import type { FieldDescriptor } from '../projections/card.js';

/**
 * A JSON value field.
 *
 * - `json()` — an OPAQUE value: passes validation unchecked.
 * - `json(Entity)` — an embedded value object: the entity's SHAPE projection is
 *   inlined as JSON Schema nesting (`properties`/`required`), so the engine
 *   validates the nested structure and the portable descriptor carries it verbatim.
 *
 * Entity-only on purpose: an arbitrary live validator could not serialise, an
 * entity's shape can. Only the value axis travels — `role`/`lifecycle`/`boundary` of
 * the embedded fields are stripped (identity, write rules and wire conversion belong
 * to the entity standing alone, not to its embedded VALUE form). Shallow consequence:
 * nested boundaries don't run — a nested date stays its wire string.
 */
export function json<T = unknown>(): Field<T>;
export function json<E extends SchemaLike & (new (...args: any[]) => any)>(of: E): Field<InstanceType<E>>;
export function json(of?: SchemaLike): Field<unknown> {
  if (!of) return createField({ shape: { type: 'object' } });
  const card = describe(of);
  const properties: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(card.properties)) {
    const { 'x-fougere': _ext, ...shapeOnly } = prop as FieldDescriptor;
    properties[key] = shapeOnly;
  }
  return createField({
    shape: { type: 'object', properties, ...(card.required ? { required: card.required } : {}) },
  });
}
