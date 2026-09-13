import { Call } from '../wire/Call.js';
import { RouteAddress } from '../wire/RouteAddress.js';
import type { DispatchPort } from '../dispatch/DispatchPort.js';
import type { Transport } from '../wire/Transport.js';

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
