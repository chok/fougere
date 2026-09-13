import { type EntityConstructor } from '@fougere/schema';
import type { CrudOpName } from './CrudOpName.js';

/** Which view each op speaks — omitted ops speak the entity, the trivial view. */
export type CrudViews = Partial<Record<CrudOpName, EntityConstructor>>;
