import { Format } from '../../lib/Format.js';
import { SHAPE_TYPES, type Judged, type Shape } from './Shape.js';

const SHAPE = 'field/shape';

const TYPE = Format.either(
  Format.tokens(SHAPE_TYPES),
  Format.tuple(Format.tokens(SHAPE_TYPES), Format.tokens(['null'])),
);

const CHILD = Format.ref(SHAPE);

const DIALECT = Format.tokens(['https://json-schema.org/draft/2020-12/schema']);

const JUDGED = {
  $anchor: Format.text,
  $comment: Format.text,
  $defs: Format.anything,
  $id: Format.text,
  $recursiveAnchor: Format.flag,
  $recursiveRef: Format.text,
  $ref: Format.text,
  $schema: DIALECT,
  $vocabulary: Format.anything,
  type: TYPE,
  const: Format.anything,
  enum: Format.listOf(Format.anything),
  required: Format.listOf(Format.text),
  not: CHILD,
  anyOf: Format.listOf(CHILD),
  allOf: Format.listOf(CHILD),
  oneOf: Format.listOf(CHILD),
  if: CHILD,
  then: CHILD,
  else: CHILD,
  format: Format.text,
  properties: Format.anything,
  patternProperties: Format.anything,
  additionalProperties: Format.anything,
  unevaluatedProperties: Format.anything,
  minProperties: Format.count,
  maxProperties: Format.count,
  propertyNames: CHILD,
  dependentRequired: Format.anything,
  dependentSchemas: Format.anything,
  dependencies: Format.anything,
  prefixItems: Format.listOf(CHILD),
  items: CHILD,
  additionalItems: Format.anything,
  unevaluatedItems: Format.anything,
  contains: CHILD,
  minContains: Format.count,
  maxContains: Format.count,
  minItems: Format.count,
  maxItems: Format.count,
  uniqueItems: Format.flag,
  minimum: Format.number,
  maximum: Format.number,
  exclusiveMinimum: Format.number,
  exclusiveMaximum: Format.number,
  multipleOf: Format.number,
  minLength: Format.count,
  maxLength: Format.count,
  pattern: Format.text,
} satisfies Record<Judged, Format<unknown>>;

const ANNOTATIONS = {
  title: Format.text,
  description: Format.text,
  deprecated: Format.flag,
  examples: Format.listOf(Format.anything),
};

/** What a shape may state: the keywords the engine judges, and the annotations. */
export const SHAPE_FORMAT = Object.entries({ ...JUDGED, ...ANNOTATIONS })
  .reduce((format, [keyword, admits]) => format.key(keyword, admits), Format.of(SHAPE))
  .closed()
  .as<Shape>();
