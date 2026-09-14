import type { SchemaView } from '@fougere/schema';
import type { AuthContext } from './AuthContext.js';
import type { AuthRuntime } from './AuthRuntime.js';

/** Lazy auth declaration written in fougere.config.ts. */
export interface AuthConfig {
  /** Build the runtime — invoked by createApp at boot with the resolved storage handles. */
  create(ctx: AuthContext): AuthRuntime | Promise<AuthRuntime>;
  /**
   * Entities the provider will use. Optional metadata — useful for the core's
   * future migration registry to know which tables auth needs.
   */
  entities?: Record<string, SchemaView>;
}
