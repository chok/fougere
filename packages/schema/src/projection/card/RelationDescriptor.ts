import type { Relation } from '../../axis/role/Relation.js';

export type RelationDescriptor = Pick<Relation, 'kind' | 'onDelete'> & { to: string };
