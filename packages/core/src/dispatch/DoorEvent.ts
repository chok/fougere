import type { DoorRequest } from '../wire/DoorRequest.js';

export type DoorStage = 'received' | 'decoded' | 'encoded' | 'failed';

/** Immutable transition of one request at a door, observed beside the calls it makes. */
export class DoorEvent {
  private constructor(
    readonly stage: DoorStage,
    readonly request: DoorRequest,
    readonly error?: unknown,
  ) {
    Object.freeze(this);
  }

  static received(request: DoorRequest): DoorEvent {
    return new DoorEvent('received', request);
  }

  static decoded(request: DoorRequest): DoorEvent {
    return new DoorEvent('decoded', request);
  }

  static encoded(request: DoorRequest): DoorEvent {
    return new DoorEvent('encoded', request);
  }

  static failed(request: DoorRequest, error: unknown): DoorEvent {
    return new DoorEvent('failed', request, error);
  }
}
