import type { JsonSchema } from '../lib/JsonSchema.js';

export interface Meta {
  description?: string;
}

export const META_FORMAT: JsonSchema = {
  type: 'object',
  properties: { description: { type: 'string' } },
  additionalProperties: false,
};
