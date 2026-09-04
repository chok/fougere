/** App-level middleware — intercepts handler facade operations. */

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
  /** Transport-agnostic invocation context (params, query, body, state). */
  invocation?: import('../wire/Invocation.js').InvocationContext;
}

export type AppNext = () => Promise<unknown>;
export type AppMiddleware = (ctx: OperationContext, next: AppNext) => Promise<unknown>;

// ── Runner ──────────────────────────────────────

/**
 * Execute a middleware chain (onion model) then the handler.
 */
export function runMiddlewares(
  middlewares: AppMiddleware[],
  ctx: OperationContext,
  handler: AppNext,
): Promise<unknown> {
  let index = 0;
  const next = (): Promise<unknown> => {
    if (index < middlewares.length) {
      return middlewares[index++](ctx, next);
    }
    return handler();
  };
  return next();
}
