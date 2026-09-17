import type { JsonSchema } from '../../lib/JsonSchema.js';
import type { GeneratorRef } from './Generators.js';

export const CREATE_TOKENS = ['now', 'optional'] as const;
export const UPDATE_TOKENS = ['now', 'forbidden'] as const;

export interface LifecycleRules {
  create?: { value: unknown } | { generate: GeneratorRef } | (typeof CREATE_TOKENS)[number];
  update?: (typeof UPDATE_TOKENS)[number];
}

export const LIFECYCLE_FORMAT: JsonSchema = {
  type: 'object',
  properties: {
    create: {
      if: { type: 'string' },
      then: { enum: [...CREATE_TOKENS] },
      else: {
        type: 'object',
        properties: { value: true, generate: { type: 'string' } },
        minProperties: 1,
        maxProperties: 1,
        additionalProperties: false,
      },
    },
    update: { enum: [...UPDATE_TOKENS] },
  },
  additionalProperties: false,
};
