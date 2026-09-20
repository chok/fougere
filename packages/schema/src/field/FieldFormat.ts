import type { Axis } from '../axis/Axis.js';
import { Format } from '../lib/Format.js';
import type { JsonSchema } from '../lib/JsonSchema.js';
import { SHAPE_FORMAT } from '../axis/shape/ShapeFormat.js';

/**
 * What a field may state, composed from the keys that state a format: each is carried whole and
 * cited by its `$id`, so the document travels alone and a key keeps its own identity. `shape` is
 * cited like the rest — it is JSON Schema, and JSON Schema is what states its keywords.
 */
export function fieldFormat(axes: readonly [string, Axis][]): JsonSchema {
  const document = axes.reduce(
    (held, [slot, axis]) => held.cites(slot, axis.format),
    Format.of('field').cites('shape', SHAPE_FORMAT),
  );

  return document.closed().schema as JsonSchema;
}
