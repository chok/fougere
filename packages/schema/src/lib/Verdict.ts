/**
 * A field's verdict. `path` is where INSIDE the value the refusal happened — empty when the
 * field itself is refused, `['street']` when the shape below it is.
 */
export type Verdict = { value: unknown } | { refusal: string; path?: readonly string[] };
