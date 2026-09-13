// ── Types ───────────────────────────────────────
export interface OperationContext {
  /** Entity name (e.g. 'product'). */
  entity: string;
  /**
   * Which frond owns this operation — the unit that gets deployed, and therefore the
   * one a reader groups by first. Absent only where no frond claims the call.
   */
  frond?: string;
  /** Operation name (e.g. 'create', 'findById', 'searchByTitle'). */
  operation: string;
  /** Arguments passed to the operation. */
  args: unknown[];
  /** Extensible bag — middlewares deposit data here (user, permissions, etc.). */
  state: Record<string, unknown>;
  /** Transport-agnostic invocation context (params, query, input, state). */
  invocation?: import('./InvocationContext.js').InvocationContext;
}
