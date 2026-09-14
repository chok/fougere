/** What a host must read off the request before any decision is possible. */
export interface DoorRequest {
  method: string;
  /** Path with no query string. The REST facade strips its own `/api` prefix. */
  path: string;
  query: Record<string, string>;
  body?: unknown;
  /** The server-resolved session. */
  state: Record<string, unknown>;
}
