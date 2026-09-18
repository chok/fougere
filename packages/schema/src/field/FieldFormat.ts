import { EXTENSION_AXES } from '../axis/Axis.js';
import type { JsonSchema } from '../lib/JsonSchema.js';
import { META_FORMAT } from './Meta.js';

const SLOTS: readonly (readonly [string, JsonSchema])[] = [
  ...EXTENSION_AXES.map((axis) => [axis.slot, axis.format] as const),
  ['meta', META_FORMAT],
];

/**
 * What a field may state, composed from the keys that state a format: each one is carried whole
 * under `$defs` and cited by its `$id`, so the document travels alone and a key keeps its own
 * identity. `shape` is JSON Schema itself, and `Shapes.is` is what reads it.
 */
export const FIELD_FORMAT: JsonSchema = {
  $id: 'https://fougere.dev/schema/field',
  type: 'object',
  properties: {
    shape: true,
    ...Object.fromEntries(SLOTS.map(([slot, format]) => [slot, { $ref: format.$id }])),
  },
  propertyNames: { enum: ['shape', ...SLOTS.map(([slot]) => slot)] },
  $defs: Object.fromEntries(SLOTS),
};
