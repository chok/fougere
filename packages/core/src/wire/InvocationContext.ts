export interface InvocationContext {
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  input: unknown;
  state: Record<string, unknown>;
  trace?: string;
  identity?: string;
  caller?: string;
  /** Epoch milliseconds before which this call is not to run. */
  runAt?: number;
  /** Written by the receiver of a call from another process, whose state was judged where it entered. */
  crossed?: true;
}
