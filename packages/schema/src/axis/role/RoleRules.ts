import type { Relation } from './Relation.js';

export interface RoleRules {
  primary?: boolean;
  index?: boolean;
  unique?: boolean;
  relation?: Relation;
}
