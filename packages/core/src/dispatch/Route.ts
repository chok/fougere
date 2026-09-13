import type { Call } from '../wire/Call.js';
import type { RouteAddress } from '../wire/RouteAddress.js';
import type { RouteKind } from '../wire/RouteKind.js';

/** Executable destination known by the dispatcher. */
export interface Route {
  readonly kind: RouteKind;
  readonly address: RouteAddress;
  execute(call: Call): Promise<unknown>;
}
