import type { Call } from '../wire/Call.js';
import type { RouteKind } from '../wire/RouteAddress.js';
import type { DispatchStage } from './DispatchStage.js';

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
