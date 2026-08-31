import type { Call } from '../contract/Call.js';
import type { RouteAddress, RouteKind } from '../contract/RouteAddress.js';

/** Executable destination known by the dispatcher. */
export interface Route {
  readonly kind: RouteKind;
  readonly address: RouteAddress;
  execute(call: Call): Promise<unknown>;
}
