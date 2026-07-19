import { createField, type Field } from '../field/index.js';

/**
 * Auto-managed timestamp, stamped at creation — optional in `new X(input)`.
 * Immutable by default: a creation timestamp re-supplied in a patch is an
 * error (decided 2026-07-15).
 */
export function auto(): Field<Date, true> {
  return createField<Date, true>({
    shape: { type: 'string', format: 'date-time' },
    lifecycle: { create: 'now', update: 'forbidden' },
  });
}
