import type { EntityEntry as ScannedEntity } from '@fougere/core';

/** A live class in-process, or one rebuilt from the card of a frond that never crossed. */
export type EntityEntry = Pick<ScannedEntity, 'name' | 'entityClass'>;
