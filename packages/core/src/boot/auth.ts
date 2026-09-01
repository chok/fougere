/**
 * What an auth provider promises the boot, and what the boot hands it — the whole of
 * the contract between core and an `@fougere/auth-*` package.
 */
import type { SchemaView } from '@fougere/schema';
import type { Storage, StorageFactory } from '../storage.js';

/**
 * Lazy auth declaration written in fougere.config.ts.
 *
 * Each @fougere/auth-* package exports a factory (e.g. `betterAuth(opts)`) that
 * returns this shape. The `create()` method is called once at boot with the
 * resolved db + storageFactory, so the provider can wire its engine through Fougere.
 */
export interface AuthConfig {
  /** Build the runtime — invoked by createApp at boot with the resolved storage handles. */
  create(ctx: AuthContext): AuthRuntime | Promise<AuthRuntime>;
  /**
   * Entities the provider will use. Optional metadata — useful for the core's
   * future migration registry to know which tables auth needs.
   */
  entities?: Record<string, SchemaView>;
}

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

/**
 * Runtime returned by an auth provider's create(config, ctx) function.
 * The core mounts this on the App and the HTTP layer (Nuxt module / router) uses it.
 */
export interface AuthRuntime {
  /** Entities used by the provider, including any defaults it filled in. */
  entities: Record<string, SchemaView>;
  /**
   * Per-entity ORMs the provider built for itself. Exposed so app code can
   * query auth tables (e.g. list active sessions for a user) without rebuilding
   * the same Storage.
   */
  storages: Record<string, Storage>;
  /** Web Standard handler that processes /auth/* requests. */
  handler: (request: Request) => Promise<Response>;
  /** Programmatic API exposed by the provider (getSession, signOut, ...). */
  api: Record<string, unknown>;
  /** Effective mount path (echoes config.basePath or the provider's default). */
  basePath: string;
}
