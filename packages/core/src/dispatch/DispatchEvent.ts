import type { Call } from '../wire/Call.js';
import type { RouteKind } from '../wire/RouteKind.js';
import type { DispatchStage } from './DispatchStage.js';
import type { DoorRequest } from '../wire/DoorRequest.js';

/** Immutable transition observed across one dispatch lifecycle. */
export class DispatchEvent {
  private constructor(
    readonly stage: DispatchStage,
    readonly call: Call,
    readonly routeKind?: RouteKind,
    readonly error?: unknown,
    /** The request at a door this call was made within — absent for a call no door received. */
    readonly request?: DoorRequest,
  ) {
    Object.freeze(this);
  }

  static received(call: Call, request?: DoorRequest): DispatchEvent {
    return new DispatchEvent('received', call, undefined, undefined, request);
  }

  static resolved(call: Call, routeKind: RouteKind, request?: DoorRequest): DispatchEvent {
    return new DispatchEvent('resolved', call, routeKind, undefined, request);
  }

  static completed(call: Call, routeKind: RouteKind, request?: DoorRequest): DispatchEvent {
    return new DispatchEvent('completed', call, routeKind, undefined, request);
  }

  static failed(call: Call, error: unknown, routeKind?: RouteKind, request?: DoorRequest): DispatchEvent {
    return new DispatchEvent('failed', call, routeKind, error, request);
  }

  static settled(call: Call, routeKind?: RouteKind, request?: DoorRequest): DispatchEvent {
    return new DispatchEvent('settled', call, routeKind, undefined, request);
  }
}
