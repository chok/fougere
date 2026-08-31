/**
 * A Transport built from an app — the two ways a call enters this process.
 *
 * `Transport` is `wire/`'s shape; making one needs an App and the transport entry.
 */
import type { App } from './types.js';
import type { Transport } from '../wire/call.js';
import { createTransportEntry } from '../entry/TransportEntry.js';

/**
 * Build the local runner — the reference realization of Transport.
 *
 * Resolves strictly from the app's own container: a call that lands here is
 * judged here. A miss is a typed NOT_FOUND, never a forward to another remote.
 */
export function createLocalRunner(app: App, surface?: string): Transport {
  return createTransportEntry(app.local, surface);
}

/**
 * Build the app runner — same judgment, but resolution follows the app's
 * topology: local façades and remote doublures alike. This is the runner
 * an app's own entry points (browser endpoint, bridges) stand on.
 *
 * `surface` is the audience this runner serves, and it belongs to the DOOR that
 * builds the runner, never to the call: a caller cannot name its own audience
 * any more than it can name its own identity (`state` is stamped server-side
 * for the same reason). Reaching the admin door IS the proof. So `FrondCall`
 * gains nothing and the wire format gains nothing — a remote frond's audience
 * is simply which URL `remotes:` points at.
 */
export function createAppRunner(app: App, surface?: string): Transport {
  return createTransportEntry(app, surface);
}
