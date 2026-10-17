import type { RemoteListener } from './RemoteListener.js';

/** Who listens to a fact in another process — answered by the remote router, read by the emission. */
export interface Elsewhere {
  listenersOf(fact: string): Promise<{ listeners: RemoteListener[]; unreachable: string[] }>;
}
