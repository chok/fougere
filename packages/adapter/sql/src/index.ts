export { createTableSQL, createIndexSQL, indexSQL, addForeignKeyConstraintSQL, generateSQL, autoMigrate, compiler } from './ddl.js';
export { onQuery, logQueries, type QueryEvent, type QuerySink } from './query.js';
export type { GenerateOptions, SqlSink } from './ddl.js';
export { toTable, toTables, toTableName, toSnakeCase, isKeyed, orderTables } from './table.js';
export type {
  TableDef,
  ColumnDef,
  ColumnShape,
  ColumnReference,
  RelationResolve,
  FkEdge,
  TableOrder,
  EntityEntry,
  FrondLike,
  AppLike,
} from './table.js';
export {
  columnTypeFor,
  dialects,
  resolveDialect,
  sqliteDialect,
  pgDialect,
  mysqlDialect,
  mssqlDialect,
} from './dialect.js';
export type { Dialect, DialectName } from './dialect.js';
export type { SqlField, SqlFields } from './fields.js';
export { SqlEntityOrm, createOrmFactory } from './crud.js';
export type { OrmFactoryOptions } from './crud.js';
export { codecFor, codecsOf } from './values.js';
export type { ValueCodec } from './values.js';
// The driver this package owns is NOT here: `better-sqlite3` is native and `node:fs` is a
// builtin, and an index that re-exported them made the whole adapter unreachable from a
// runtime that has neither. It lives at `@fougere/adapter-sql/sqlite`.
export { setupKysely, sqlSink } from './setup.js';
export type { Setup, SetupOptions } from './setup.js';
export { actualState, desiredTables, delta, orderChanges, changeSQL, planMigration, migrate } from './diff.js';
export type { SchemaState, Change } from './diff.js';
// The non-additive half — realised only from a step a human wrote down.
export { planStep, collapseChain, stepSQL, applyStep } from './step.js';
export type { Plan, PlanOptions, Refusal, StepChange } from './step.js';
