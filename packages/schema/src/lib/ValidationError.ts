export interface ValidationError {
  /**
   * Where the refusal happened: the field, then where under it the shape refused.
   * Empty when the input itself is refused. Segments, never a sentence — a field may
   * legally be named `a.b`, and re-parsing a joined path invents a segment it never had.
   */
  path: readonly string[];
  message: string;
}
