/**
 * A discovered middleware — a class declaring `around(ctx, next)`, which runs before and
 * after every operation in its scope.
 */
export interface MiddlewareEntry {
  /** Class name — what `frond.config.ts` addresses to widen the scope. */
  name: string;
  /** The middleware class. */
  ctor: new (...args: never[]) => unknown;
  /** How far it reaches: its own frond's entities, or every operation in the process. */
  scope: 'frond' | 'app';
  /** Constructor dependency type names (from AST scan). */
  deps: string[];
  /** Absolute file path (for debugging). */
  filePath: string;
}
