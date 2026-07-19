import { auto } from './auto.js';
import { createField, type Field } from '../field/index.js';

/**
 * `auto()`, plus the update stamp — the canonical `updatedAt` (Prisma
 * `@updatedAt`, Drizzle `$onUpdate`). The only new fact is `update: 'now'`;
 * shape and creation rule are auto()'s, stated once there.
 */
export function updated(): Field<Date, true> {
  const base = auto();
  return createField<Date, true>({ ...base, lifecycle: { ...base.lifecycle, update: 'now' } });
}
