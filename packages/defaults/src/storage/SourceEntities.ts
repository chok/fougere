import { type Source } from '@fougere/core';

/** One source: what realizes it, and the entities that live there. */
export interface SourceEntities {
  source: Source;
  entities: string[];
}
