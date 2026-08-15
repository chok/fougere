/** How a judge is asked — the mode a schema view carries, never a fact about a field. */

/** Patch mode: an unsent field is untouched. Distinguishes "absent, don't touch" from "absent → null". */
export interface ValidateOptions {
  patch?: boolean;
}
