import type { Kysely } from 'kysely';
import { actualTypes, type ColumnTypes } from './ColumnTypes.js';

/** What the database actually holds: column names per table. */
export type SchemaState = Map<string, Set<string>>;

export const namesOf = (types: ColumnTypes): SchemaState =>
  new Map([...types].map(([table, columns]) => [table, new Set(columns.keys())]));

/** Read the live schema. Only names are needed — an additive pass never inspects types. */
export async function actualState(db: Kysely<any>): Promise<SchemaState> {
  return namesOf(await actualTypes(db));
}
