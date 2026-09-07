/** What a table PROMISES and what it now holds, when the two stopped agreeing. */
import type { Kysely } from 'kysely';

import type { TableDef } from './table.js';

/** One column whose declaration moved and whose table did not follow. */
export interface Drift {
  table: string;
  column: string;
  /** What the entity says now. */
  declared: string;
  /** What the table still enforces. */
  held: string;
  /** What it costs, said where the reader is — a boot, not a migration plan. */
  reason: string;
}

/**
 * A migration is ADDITIVE by design: it creates what is missing and never touches a
 * column that exists. That is a promise worth keeping — nothing is dropped behind your
 * back — but it leaves a second fact unsaid, and unsaid is where it hurt: relax a
 * `required` field and the table keeps its NOT NULL, so the write fails on a row, in
 * production, long after the boot that could have named it.
 *
 * What is read here is what `actualState` already receives and throws away. `SchemaState`
 * stays a set of names on purpose: `done()` reads it to decide whether a frozen step was
 * already applied, and a wider one would make a replayed migration answer wrong.
 */
export async function drift(db: Kysely<any>, desired: TableDef[]): Promise<Drift[]> {
  const held = new Map(
    (await db.introspection.getTables())
      .filter((table) => !table.isView)
      .map((table) => [table.name, table.columns]),
  );

  const found: Drift[] = [];
  for (const table of desired) {
    const columns = held.get(table.name);
    if (!columns) continue;

    for (const column of table.columns) {
      const live = columns.find((one) => one.name === column.name);
      // A column the table does not have yet is the additive pass's business, not this one.
      if (!live) continue;

      if (column.nullable && !live.isNullable) {
        found.push({
          table: table.name,
          column: column.name,
          declared: 'optional',
          held: 'NOT NULL',
          reason: 'a write with no value for it fails at the row, not at boot',
        });
      }
      if (!column.nullable && live.isNullable && !column.primary) {
        found.push({
          table: table.name,
          column: column.name,
          declared: 'required',
          held: 'nullable',
          reason: 'the door refuses what the table would still accept',
        });
      }
    }
  }

  return found;
}

/** The one line a boot has room for, and the detail under it. */
export const driftReport = (found: Drift[]): string =>
  `${found.length} column(s) declare one thing and the table holds another:\n`
  + found
    .map((one) => `  ${one.table}.${one.column} — declared ${one.declared}, table keeps ${one.held}: ${one.reason}`)
    .join('\n');
