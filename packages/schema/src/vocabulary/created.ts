import { Field } from '../field/index.js';

/**
 * The canonical `createdAt` — stamped at creation, optional in `new X(input)`.
 * Immutable by default: a creation timestamp re-supplied in a patch is an
 * error (decided 2026-07-15).
 *
 * Named for what it is, and its dual {@link updated} is built on it. It used to be
 * called `auto()`, which said "the server fills this" without saying *when* — while
 * `updated()` next to it named its moment. Every template in the repo spelled it
 * `createdAt: auto()`: the field always had the name the constructor was missing.
 */
export function created(): Field<Date, true> {
  return new Field<Date, true>({
    shape: { type: 'string', format: 'date-time' },
    lifecycle: { create: 'now', update: 'forbidden' },
  });
}
