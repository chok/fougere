import { CALL_ENDPOINT, fetcher as browserFetcher } from '@fougere/app/client';
import { applyAdminExtensions } from './AdminExtension.js';
import { createDataProvider, createLazyDataProvider, type FougereDataProvider } from './FougereDataProvider.js';
import { fetchCard, keysOf, resourcesOf } from './AdminResource.js';
import type { AdminRuntimeOptions } from './AdminRuntimeOptions.js';
import type { LoadedAdmin } from './LoadedAdmin.js';

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
