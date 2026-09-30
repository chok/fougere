import type { HttpMethod } from '@fougere/http';

export interface GenerateRoutesOptions {
  /** Base path prefix (e.g. '/api'). Default: ''. */
  prefix?: string;
  /** Override route config per address, then per operation. */
  overrides?: Record<string, Record<string, { method?: HttpMethod; path?: string; status?: number }>>;
  /** Keep only the addresses this answers true for. */
  filter?: (address: string, frondName: string) => boolean;
  /** Surface name for filtering (e.g. 'rest', 'graphql'). Uses frond.config.ts surfaces if set. */
  surface?: string;
}
