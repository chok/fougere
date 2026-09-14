import type { StorageFactory } from '../storage/StorageFactory.js';

/**
 * Context passed by the core to an auth provider's create() function.
 * Provides the resources the provider needs to integrate with the app.
 */
export interface AuthContext {
  /** Storage handle (Kysely DB instance, Prisma client, etc.) — opaque to core. */
  db: unknown;
  /** Per-entity storage factory — auth provider uses this to back its adapter. */
  storageFactory: StorageFactory;
}
