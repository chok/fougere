import type { RoleRules } from '../../axis/role/RoleRules.js';
import type { RelationDescriptor } from './RelationDescriptor.js';

export type RoleDescriptor = Pick<RoleRules, 'primary' | 'index'> & {
  unique?: string[][];
  relation?: RelationDescriptor;
};
