/** One request a door received — a REST request, a GraphQL document, a command — and not a call: it may make several. */
export class DoorRequest {
  /** Unique within the process, which is all that relating a request to its calls asks — a trace has its own ids. */
  private static opened = 0;

  private constructor(readonly id: number, readonly door: string) {
    Object.freeze(this);
  }

  static open(door: string): DoorRequest {
    return new DoorRequest(++DoorRequest.opened, door);
  }
}
