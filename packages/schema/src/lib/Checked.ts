/**
 * A field's verdict. `path` is where INSIDE the value the refusal happened — empty when the
 * field itself is refused, `['street']` when the shape below it is.
 */
export type Checked = { value: unknown } | { error: string; path?: readonly string[] };
