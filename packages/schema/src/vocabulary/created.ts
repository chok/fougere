import { Field } from "../field/index.js";
import { date } from "./date.js";

/**
 * The canonical `createdAt` — stamped at creation, immutable after: a creation timestamp
 * re-supplied in a patch is an error.
 */
export function created(): Field<Date> {
  return date().with({
    lifecycle: { create: "now", update: "forbidden" },
  });
}
