import type { Kysely } from 'kysely';
/** What the database actually holds: column names per table. */
export type SchemaState = Map<string, Set<string>>;

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

export const namesOf = (types: ColumnTypes): SchemaState =>
  new Map([...types].map(([table, columns]) => [table, new Set(columns.keys())]));

/** Read the live schema. Only names are needed — an additive pass never inspects types. */
export async function actualState(db: Kysely<any>): Promise<SchemaState> {
  return namesOf(await actualTypes(db));
}
