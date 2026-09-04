import { Call } from '../contract/Call.js';
import { RouteAddress } from '../contract/RouteAddress.js';
import type { DispatchPort } from '../dispatch/DispatchPort.js';
import type { Transport } from '../wire/call.js';

/** Adapts the historical transport signature to the canonical dispatch port. */
export function createTransportEntry(dispatcher: DispatchPort, surface?: string): Transport {
  return (legacy, invocation) => dispatcher.dispatch(new Call(
    new RouteAddress({
      entity: legacy.entity,
      operation: legacy.op,
      ...(surface !== undefined ? { surface } : {}),
    }),
    invocation,
  ));
}
