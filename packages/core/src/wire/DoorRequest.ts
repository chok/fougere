/** One request a door received — a REST request, a GraphQL document, a command — and not a call: it may make several. */
export class DoorRequest {
  private constructor(readonly id: string, readonly door: string) {
    Object.freeze(this);
  }

  static open(door: string): DoorRequest {
    return new DoorRequest(globalThis.crypto.randomUUID(), door);
  }
}
