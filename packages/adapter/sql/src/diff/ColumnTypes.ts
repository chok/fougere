import type { Kysely } from 'kysely';

/** The type the engine reports for each column, per table. */
export type ColumnTypes = Map<string, Map<string, string>>;

/** Read the live schema, with each column's type as the engine names it. */
export async function actualTypes(db: Kysely<any>): Promise<ColumnTypes> {
  const types: ColumnTypes = new Map();
  for (const table of await db.introspection.getTables()) {
    if (table.isView) continue;
    types.set(table.name, new Map(table.columns.map((column) => [column.name, column.dataType])));
  }

  return types;
}
