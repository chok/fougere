import type { JsonSchema } from '../../lib/JsonSchema.js';
import { ON_DELETE, RELATION_KINDS, type Relation } from './Relation.js';

export interface RoleRules {
  primary?: boolean;
  index?: boolean;
  unique?: boolean;
  relation?: Relation;
}

export const ROLE_FORMAT: JsonSchema = {
  type: 'object',
  properties: {
    primary: { type: 'boolean' },
    index: { type: 'boolean' },
    unique: { type: 'boolean' },
    relation: {
      type: 'object',
      required: ['kind'],
      properties: {
        to: true,
        kind: { enum: [...RELATION_KINDS] },
        onDelete: { enum: [...ON_DELETE] },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};
