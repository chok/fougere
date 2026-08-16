/** What every judge in this package answers — one shape, whatever it judged. */

export interface ValidationError {
  /** The field name, or the axis it failed on — `lifecycle.create`, `role.relation.kind`. */
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] };

/** One value's verdict — the judge hands back what it read, decoded or refused. */
export type Checked = { value: unknown } | { error: string };
