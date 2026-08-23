import { Call } from '../contract/Call.js';
import { RouteAddress } from '../contract/RouteAddress.js';
import type { DispatchPort } from '../dispatch/DispatchPort.js';
import type { FrondCall, Transport } from '../wire/call.js';
import type { InvocationContext } from '../contract/Invocation.js';

/** Object entry for the historical transport contract. */
export class TransportEntry {
  constructor(
    private readonly dispatcher: DispatchPort,
    private readonly surface?: string,
  ) {}

  receive(legacy: FrondCall, invocation: InvocationContext): Promise<unknown> {
    return this.dispatcher.dispatch(new Call(
      new RouteAddress({
        entity: legacy.entity,
        operation: legacy.op,
        ...(this.surface !== undefined ? { surface: this.surface } : {}),
      }),
      invocation,
    ));
  }
}

/** Adapt the historical transport signature to the canonical dispatch port. */
export function createTransportEntry(dispatcher: DispatchPort, surface?: string): Transport {
  const entry = new TransportEntry(dispatcher, surface);
  return entry.receive.bind(entry);
}
