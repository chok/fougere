/** What a receiver accepts before it stops reading an input. */
export const MAX_BODY_BYTES = 1024 * 1024;

/** Everything a caller's envelope covers — the call as the sender meant it. */
export interface SignedCall {
  entity: string;
  op: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  input?: unknown;
  state?: Record<string, unknown>;
}
