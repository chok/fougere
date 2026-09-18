import type { JsonSchema } from '../../lib/JsonSchema.js';
import type { BoundaryRules } from './BoundaryRules.js';

export type BoundaryRef = 'isoDate' | (string & {}) | BoundaryRules;

const closedOr = (verb: 'decode' | 'encode'): JsonSchema => ({
  if: { type: 'string' },
  then: { const: 'closed' },
  else: { type: 'object', required: [verb], properties: { [verb]: { type: 'string' } }, additionalProperties: false },
});

export const BOUNDARY_FORMAT: JsonSchema = {
  $id: 'https://fougere.dev/schema/axis/boundary',
  if: { type: 'string' },
  else: {
    type: 'object',
    properties: { in: closedOr('decode'), out: closedOr('encode') },
    additionalProperties: false,
  },
};
