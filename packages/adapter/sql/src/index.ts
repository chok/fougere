export { autoMigrate, compiler, createTableSQL, generateSQL } from './ddl/SqlSink.js';
export { onQuery } from './query/QuerySink.js';
export type { QueryEvent } from './query/QueryEvent.js';
export type { QuerySink } from './query/QuerySink.js';
export { toSnakeCase, toTable, toTableName, toTables } from './table/TableDef.js';
export { orderTables } from './order/TableOrder.js';
export type { AppLike } from './table/AppLike.js';
export type { EntityEntry } from './table/EntityEntry.js';
export type { FrondLike } from './table/FrondLike.js';
export { columnTypeFor, dialects } from './dialect/Dialect.js';
export type { Dialect } from './dialect/Dialect.js';
export type { SqlField } from './fields/SqlField.js';
export type { SqlFields } from './fields/SqlFields.js';
export { SqlStorage, createStorageFactory } from './crud/SqlStorage.js';
export { codecsOf } from './values.js';
// The driver this package owns is NOT here: `better-sqlite3` is native and `node:fs` is a
// builtin, and an index that re-exported them made the whole adapter unreachable from a
// runtime that has neither. It lives at `@fougere/adapter-sql/sqlite`.
export { createKyselySource } from './source/SqlSource.js';
export type { SqlSource } from './source/SqlSource.js';
export { drift } from './drift.js';
export type { Drift } from './drift.js';
export { actualState, desiredTables, delta, changeSQL, migrate } from './diff.js';
export type { Change } from './diff/Change.js';
export type { SchemaState } from './diff/SchemaState.js';
// The non-additive half — realised only from a step a human wrote down.
export { planStep, collapseChain, applyStep } from './step.js';
export type { Plan } from './step/Plan.js';
export type { StepChange } from './step/StepChange.js';
