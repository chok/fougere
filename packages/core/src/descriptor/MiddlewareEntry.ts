/**
 * A discovered middleware — a class declaring `around(ctx, next)`, which runs before and after
 * every operation of its frond, and of the fronds that inherit from it.
 *
 * How far it reaches is not written here: it is where the frond sits in `FougereConfig.fronds`,
 * and stating it twice would put one decision in two places.
 */
export interface MiddlewareEntry {
  /** Class name — the key it registers under in its frond's scope. */
  name: string;
  /** The middleware class. */
  ctor: new (...args: never[]) => unknown;
  /** Constructor dependency type names (from AST scan). */
  deps: string[];
  /** Absolute file path (for debugging). */
  filePath: string;
}
