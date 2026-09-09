export interface ValidationError {
  /**
   * Where the refusal happened: the field, then where under it the shape refused.
   * Empty when the input itself is refused. Segments, never a sentence — a field may
   * legally be named `a.b`, and re-parsing a joined path invents a segment it never had.
   */
  path: readonly string[];
  message: string;
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] };

/**
 * A field's verdict. `path` is where INSIDE the value the refusal happened — empty when the
 * field itself is refused, `['street']` when the shape below it is.
 */
export type Checked = { value: unknown } | { error: string; path?: readonly string[] };

/**
 * A path as a message writes it — `addr.street`. One rendering among others, and the
 * reason the value stays segmented: this one cannot be read back.
 */
export const dotted = (path: readonly string[]): string => path.join('.');
