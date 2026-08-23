import type { Call } from '../contract/Call.js';
import type { RouteAddress } from '../contract/RouteAddress.js';

export type RouteKind = 'local' | 'remote' | 'system';

/** Executable destination known by the dispatcher. */
export interface Route {
  readonly kind: RouteKind;
  readonly address: RouteAddress;
  execute(call: Call): Promise<unknown>;
}
