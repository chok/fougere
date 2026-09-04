import type { Call } from '../wire/call.js';
import type { RouteAddress, RouteKind } from '../wire/RouteAddress.js';

/** Executable destination known by the dispatcher. */
export interface Route {
  readonly kind: RouteKind;
  readonly address: RouteAddress;
  execute(call: Call): Promise<unknown>;
}
