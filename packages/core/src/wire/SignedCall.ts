/** Everything a caller's envelope covers — the call as the sender meant it. */
export interface SignedCall {
  entity: string;
  op: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  input?: unknown;
  state?: Record<string, unknown>;
  /** The hour, pinned like the input: moving it is moving the call. */
  runAt?: number;
}
