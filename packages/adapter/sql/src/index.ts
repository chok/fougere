export { createTableSQL, generateSQL, autoMigrate, compiler } from './ddl.js';
export { onQuery } from './query.js';
export { toTable, toTables, toTableName, toSnakeCase } from './table.js';
export { orderTables } from './order.js';
export type {
  EntityEntry,
  FrondLike,
  AppLike,
} from './table.js';
export {
  columnTypeFor,
  dialects,
} from './dialect.js';
export type { Dialect } from './dialect.js';
export type { SqlField, SqlFields } from './fields.js';
export { SqlStorage, createStorageFactory } from './crud.js';
export { codecsOf } from './values.js';
// The driver this package owns is NOT here: `better-sqlite3` is native and `node:fs` is a
// builtin, and an index that re-exported them made the whole adapter unreachable from a
// runtime that has neither. It lives at `@fougere/adapter-sql/sqlite`.
export { createKyselySource } from './source.js';
export type { SqlSource } from './source.js';
export { drift } from './drift.js';
export type { Drift } from './drift.js';
export { actualState, desiredTables, delta, changeSQL, migrate } from './diff.js';
export type { SchemaState, Change } from './diff.js';
// The non-additive half — realised only from a step a human wrote down.
export { planStep, collapseChain, applyStep } from './step.js';
export type { Plan, StepChange } from './step.js';
