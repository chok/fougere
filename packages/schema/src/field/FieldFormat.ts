import type { Axis } from '../axis/Axis.js';
import type { JsonSchema } from '../lib/JsonSchema.js';
import { META_FORMAT } from './Meta.js';

/**
 * What a field may state, composed from the keys that state a format: each one is carried whole
 * under `$defs` and cited by its `$id`, so the document travels alone and a key keeps its own
 * identity. `shape` is JSON Schema itself, and `Shapes.is` is what reads it.
 */
export function fieldFormat(axes: readonly Axis[]): JsonSchema {
  const slots: (readonly [string, JsonSchema])[] = [
    ...axes.map((axis) => [axis.slot, axis.format] as const),
    ['meta', META_FORMAT],
  ];

  return {
    $id: 'https://fougere.dev/schema/field',
    type: 'object',
    properties: {
      shape: true,
      ...Object.fromEntries(slots.map(([slot, format]) => [slot, { $ref: format.$id }])),
    },
    propertyNames: { enum: ['shape', ...slots.map(([slot]) => slot)] },
    $defs: Object.fromEntries(slots),
  };
}
