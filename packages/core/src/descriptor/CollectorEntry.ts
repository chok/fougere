/** A discovered collector (resolves handler input params from invocation context). */
export interface CollectorEntry {
  /** Registration key of the TYPE this collector resolves — 'user', 'ability'. */
  typeName: string;
  /** The collector class. */
  ctor: new (...args: never[]) => unknown;
  /** Constructor dependency type names (from AST scan). */
  deps: string[];
  /** Absolute file path (for debugging). */
  filePath: string;
}
