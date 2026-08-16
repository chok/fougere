import { Field, type Fields } from '../Field.js';
import type { SchemaView } from '../SchemaView.js';
import { describe } from '../card/describe.js';
import type { FieldDescriptor } from '../card/Descriptor.js';

/**
 * A JSON value field. `json()` is OPAQUE — it passes validation unchecked. `json(Entity)`
 * inlines the entity's SHAPE as JSON Schema nesting, so the engine validates the structure
 * and the card carries it verbatim.
 *
 * Only the value axis travels: the embedded fields' role, lifecycle and boundary are
 * stripped, so a nested date stays its wire string.
 */
export function json<T = unknown>(): Field<T>;
export function json<E extends SchemaView & (new (...args: any[]) => any)>(of: E): Field<InstanceType<E>>;
export function json(of?: SchemaView): Field<unknown> {
  if (!of) return new Field({ shape: { type: 'object' } });
  const card = describe(of);
  const properties: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(card.properties)) {
    const { 'x-fougere': _ext, ...shapeOnly } = prop as FieldDescriptor;
    properties[key] = shapeOnly;
  }
  return new Field({
    shape: { type: 'object', properties, ...(card.required ? { required: card.required } : {}) },
  });
}
