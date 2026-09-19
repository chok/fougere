import type { Kysely } from 'kysely';
/** What the database actually holds: column names per table. */
export type SchemaState = Map<string, Set<string>>;

/** Read the live schema. Only names are needed — an additive pass never inspects types. */
export async function actualState(db: Kysely<any>): Promise<SchemaState> {
  const state: SchemaState = new Map();
  for (const table of await db.introspection.getTables()) {
    if (table.isView) continue;
    state.set(table.name, new Set(table.columns.map((column) => column.name)));
  }

  return state;
}
