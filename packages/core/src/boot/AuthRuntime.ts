import type { SchemaView } from '@fougere/schema';
import type { Storage } from '../storage/port.js';

/**
 * Runtime returned by an auth provider's create(config, ctx) function.
 * The core mounts this on the App and the HTTP layer (Nuxt module / router) uses it.
 */
export interface AuthRuntime {
  /** Entities used by the provider, including any defaults it filled in. */
  entities: Record<string, SchemaView>;
  /** Per-entity ORMs the provider built for itself. */
  storages: Record<string, Storage>;
  /** Web Standard handler that processes /auth/* requests. */
  handler: (request: Request) => Promise<Response>;
  /** Programmatic API exposed by the provider (getSession, signOut, ...). */
  api: Record<string, unknown>;
  /** Effective mount path (echoes config.basePath or the provider's default). */
  basePath: string;
}
