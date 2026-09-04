/** A Transport built from an app — the two ways a call enters this process. */
import type { App } from './types.js';
import type { Transport } from '../wire/call.js';
import { createTransportEntry } from '../entry/transport.js';

/** Build the local runner — the reference realization of Transport. */
export function createLocalRunner(app: App, surface?: string): Transport {
  return createTransportEntry(app.local, surface);
}

/** Build the app runner — same judgment, but resolution follows the app's topology: */
export function createAppRunner(app: App, surface?: string): Transport {
  return createTransportEntry(app, surface);
}
