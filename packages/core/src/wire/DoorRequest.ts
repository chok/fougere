/** One request a door received — a REST request, a GraphQL document, a command — and not a call: it may make several. */
export class DoorRequest {
  /** Unique within the process, which is all that relating a request to its calls asks — a trace has its own ids. */
  private static opened = 0;

  /** The caller's kept state as it arrived, by name — verified, never as sent. */
  readonly arrived = new Map<string, unknown>();
  /** What the request's calls wrote, to go back with the answer — `undefined` forgets a name. */
  readonly written = new Map<string, unknown>();
  /** The names this door can carry back; one kept where the door has nothing to carry it in is refused. */
  readonly keepable = new Set<string>();

  private constructor(readonly id: number, readonly door: string) {
    Object.freeze(this);
  }

  static open(door: string): DoorRequest {
    return new DoorRequest(++DoorRequest.opened, door);
  }
}
