import type { HttpMethod } from '@fougere/http';
import type { EntityEntry } from './EntityEntry.js';

export interface GenerateRoutesOptions {
  /** Base path prefix (e.g. '/api'). Default: ''. */
  prefix?: string;
  /** Override route config per entity. */
  overrides?: Record<string, Record<string, { method?: HttpMethod; path?: string; status?: number }>>;
  /** Filter entities. */
  filter?: (entity: EntityEntry, frondName: string) => boolean;
  /** Surface name for filtering (e.g. 'rest', 'graphql'). Uses frond.config.ts surfaces if set. */
  surface?: string;
}
