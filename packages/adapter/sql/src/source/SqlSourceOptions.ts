import { type StorageFactoryOptions } from '../crud/StorageFactoryOptions.js';

export interface SqlSourceOptions {
  /** Override naming for specific entities (e.g. better-auth wants singular table names). */
  storageFactoryOptions?: StorageFactoryOptions;
  /** What to call this storage when a query is reported. */
  name?: string;
}
