/** One card request, shared by resource discovery and every provider operation. */
import {
  CALL_ENDPOINT,
  fetcher as browserFetcher,
  type Fetcher,
} from '@fougere/app/client';
import { applyAdminExtensions, type AdminExtension } from './extensions.js';
import {
  createDataProvider,
  createLazyDataProvider,
  type FougereDataProvider,
} from './provider.js';
import { fetchCard, keysOf, resourcesOf, type AdminResource } from './resources.js';

export interface AdminRuntimeOptions {
  endpoint?: string;
  fetcher?: Fetcher;
  extensions?: readonly AdminExtension[];
}

export interface LoadedAdmin {
  resources: AdminResource[];
  provider: FougereDataProvider;
}

export interface AdminRuntime {
  /** Loads and caches the card-derived model. */
  load(): Promise<LoadedAdmin>;
  /** Synchronous shell required by react-admin; delegates after `load()` resolves. */
  dataProvider: FougereDataProvider;
}

export function createAdminRuntime(options: AdminRuntimeOptions = {}): AdminRuntime {
  const {
    endpoint = CALL_ENDPOINT,
    fetcher = browserFetcher,
    extensions = [],
  } = options;
  let loading: Promise<LoadedAdmin> | undefined;

  /** One card request, shared — and a REFUSED one is forgotten. */
  const load = (): Promise<LoadedAdmin> => loading ??= fetchCard(endpoint, fetcher)
    .then((card) => {
      const resources = applyAdminExtensions(resourcesOf(card), extensions);
      return {
        resources,
        provider: createDataProvider({ resources: keysOf(resources), endpoint, fetcher }),
      };
    })
    .catch((error: unknown) => {
      loading = undefined;
      throw error;
    });

  return {
    load,
    dataProvider: createLazyDataProvider(async () => (await load()).provider),
  };
}
