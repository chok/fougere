import { fetcher as browserFetcher, type Fetcher } from '@fougere/app/client';
import type { ResourceKey } from './ResourceKey.js';

export interface ProviderOptions {
  /** Registration key → its identity. Built from the card by `resourcesOf`. */
  resources: Record<string, ResourceKey>;
  /** The call endpoint. A named surface appends `/{surface}` to it. */
  endpoint?: string;
  fetcher?: Fetcher;
}
