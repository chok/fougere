import type { Axis } from '../axis/Axis.js';
import { Format } from '../lib/Format.js';
import type { JsonSchema } from '../lib/JsonSchema.js';
import { META_FORMAT } from './Meta.js';

/**
 * What a field may state, composed from the keys that state a format: each is carried whole and
 * cited by its `$id`, so the document travels alone and a key keeps its own identity. `shape` is
 * JSON Schema itself, and `Shapes.is` is what reads it.
 */
export function fieldFormat(axes: readonly [string, Axis][]): JsonSchema {
  const document = axes.reduce(
    (held, [slot, axis]) => held.cites(slot, axis.format),
    Format.of('field').key('shape', Format.anything),
  );

  return document.cites('meta', META_FORMAT).closed().schema as JsonSchema;
}
