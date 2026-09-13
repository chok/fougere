import type { SchemaState } from '../diff/SchemaState.js';

export interface PlanOptions {
  /** Entity key → table name. Same resolver `desiredTables` takes. */
  tableName?: (name: string) => string;
  /** What the database actually holds, from `actualState`. */
  actual?: SchemaState;
}
