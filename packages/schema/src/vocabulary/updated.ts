import { created } from './created.js';
import { Field } from '../field/index.js';

/**
 * `auto()`, plus the update stamp — the canonical `updatedAt` (Prisma
 * `@updatedAt`, Kysely-side `$onUpdate` equivalents). The only new fact is `update: 'now'`;
 * shape and creation rule are auto()'s, stated once there.
 */
export function updated(): Field<Date, true> {
  const base = created();
  return base.with({ lifecycle: { ...base.lifecycle, update: 'now' } });
}
