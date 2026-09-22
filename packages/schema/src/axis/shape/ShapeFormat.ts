import { Format } from '../../lib/Format.js';
import { SHAPE_TYPES, type Shape } from './Shape.js';

const SHAPE = 'field/shape';

/** A word, or that word beside `null` — the second place is what makes a shape nullable. */
const TYPE = Format.either(
  Format.tokens(SHAPE_TYPES),
  Format.tuple(Format.tokens(SHAPE_TYPES), Format.tokens(['null'])),
);

/**
 * What a shape may state — JSON Schema's own keywords, less the ones this package has no word
 * for. `shape` used to be the one key of a field declaration nothing judged, so `minLenght: 1`
 * passed and was dropped where `lifecycle: { craete: 'now' }` had been refused since `Format`.
 * `properties` stays open because a projection folds `meta.description` into it.
 */
export const SHAPE_FORMAT = Format.of(SHAPE)
  .key('type', TYPE)
  .key('description', Format.text)
  .key('minLength', Format.count)
  .key('maxLength', Format.count)
  .key('pattern', Format.text)
  .key('format', Format.text)
  .key('enum', Format.listOf(Format.anything))
  .key('minimum', Format.number)
  .key('maximum', Format.number)
  .key('items', Format.ref(SHAPE))
  .key('minItems', Format.count)
  .key('maxItems', Format.count)
  .key('properties', Format.anything)
  .key('required', Format.listOf(Format.text))
  .key('additionalProperties', Format.anything)
  .key('propertyNames', Format.ref(SHAPE))
  .needs('type')
  .closed()
  .as<Shape>();
