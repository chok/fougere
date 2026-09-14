import { fetcher as browserFetcher, type Fetcher } from '@fougere/app/client';
import { type AdminExtension } from './AdminExtension.js';

export interface AdminRuntimeOptions {
  endpoint?: string;
  fetcher?: Fetcher;
  extensions?: readonly AdminExtension[];
}
