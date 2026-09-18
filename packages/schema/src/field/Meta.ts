import type { JsonSchema } from '../lib/JsonSchema.js';

export interface Meta {
  description?: string;
}

export const META_FORMAT: JsonSchema = {
  $id: 'https://fougere.dev/schema/field/meta',
  type: 'object',
  properties: { description: { type: 'string' } },
  additionalProperties: false,
};
