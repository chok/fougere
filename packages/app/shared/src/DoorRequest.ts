/** What a host must read off the request before any decision is possible. */
export interface DoorRequest {
  method: string;
  /** Path with no query string. The REST facade strips its own `/api` prefix. */
  path: string;
  query: Record<string, string>;
  /** What a door middleware reads before the body is — none, for a host that has none to give. */
  headers?: Headers;
  /** Read by the door, inside the cycle — what a door middleware may refuse before it happens. */
  body?: () => Promise<unknown>;
  /** The server-resolved session. */
  state: Record<string, unknown>;
}
