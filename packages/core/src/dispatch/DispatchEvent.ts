import type { Call } from '../contract/Call.js';
import type { RouteKind } from '../contract/RouteAddress.js';

export type DispatchStage = 'received' | 'resolved' | 'completed' | 'failed' | 'settled';

/** Immutable transition observed across one dispatch lifecycle. */
export class DispatchEvent {
  private constructor(
    readonly stage: DispatchStage,
    readonly call: Call,
    readonly routeKind?: RouteKind,
    readonly error?: unknown,
  ) {
    Object.freeze(this);
  }

  static received(call: Call): DispatchEvent {
    return new DispatchEvent('received', call);
  }

  static resolved(call: Call, routeKind: RouteKind): DispatchEvent {
    return new DispatchEvent('resolved', call, routeKind);
  }

  static completed(call: Call, routeKind: RouteKind): DispatchEvent {
    return new DispatchEvent('completed', call, routeKind);
  }

  static failed(call: Call, error: unknown, routeKind?: RouteKind): DispatchEvent {
    return new DispatchEvent('failed', call, routeKind, error);
  }

  static settled(call: Call, routeKind?: RouteKind): DispatchEvent {
    return new DispatchEvent('settled', call, routeKind);
  }
}

export type DispatchObserver = (event: DispatchEvent) => void;
