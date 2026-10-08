/** Everything a caller's envelope covers — the call as the sender meant it. */
export interface SignedCall {
  address: string;
  op: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  input?: unknown;
  /** What code wrote for the handler — pinned like the input, or a signed call replays with others. */
  args?: readonly unknown[];
  state?: Record<string, unknown>;
  /** The hour, pinned like the input: moving it is moving the call. */
  runAt?: number;
}
