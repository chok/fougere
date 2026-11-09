import {
  Kysely,
  DummyDriver,
  sql,
  SqliteAdapter, SqliteQueryCompiler, SqliteIntrospector,
  PostgresAdapter, PostgresQueryCompiler, PostgresIntrospector,
  MysqlAdapter, MysqlQueryCompiler, MysqlIntrospector,
  MssqlAdapter, MssqlQueryCompiler, MssqlIntrospector,
  type ColumnDefinitionBuilder,
} from 'kysely';
import type { SourceView } from '@fougere/core';
import { type ColumnDef } from '../table/ColumnDef.js';
import { isKeyed, toTableName, toTables, type TableDef } from '../table/TableDef.js';
import { deferredColumnsByTable, orderTables } from '../order/TableOrder.js';
import { columnTypeFor, resolveDialect } from '../dialect/Dialect.js';
import { type DialectName } from '../dialect/DialectName.js';
import { checkFor } from '../check.js';
import type { GenerateOptions } from './GenerateOptions.js';

const parts = {
  sqlite: [SqliteAdapter, SqliteQueryCompiler, SqliteIntrospector],
  pg: [PostgresAdapter, PostgresQueryCompiler, PostgresIntrospector],
  mysql: [MysqlAdapter, MysqlQueryCompiler, MysqlIntrospector],
  mssql: [MssqlAdapter, MssqlQueryCompiler, MssqlIntrospector],
} as const;

const engines = new Map<DialectName, Kysely<any>>();

/** A Kysely bound to a dialect's compiler but to no connection — renders SQL only. */
export function compiler(name: DialectName): Kysely<any> {
  const cached = engines.get(name);
  if (cached) return cached;
  const [Adapter, QueryCompiler, Introspector] = parts[name] as any;
  const engine = new Kysely<any>({
    dialect: {
      createAdapter: () => new Adapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (db: Kysely<any>) => new Introspector(db),
      createQueryCompiler: () => new QueryCompiler(),
    },
  });
  engines.set(name, engine);

  return engine;
}


/** Render `CREATE TABLE` for one described table. */
export function createTableSQL(
  table: TableDef,
  dialectName: DialectName,
  options?: { skipReferences?: Set<string> },
): string {
  const dialect = resolveDialect(dialectName);
  const composite = table.compositePrimary.length > 0;
  const skip = options?.skipReferences;
  let builder = compiler(dialectName).schema.createTable(table.name);
  if (dialectName !== 'mssql') builder = builder.ifNotExists();

  for (const column of table.columns) {
    const type = columnTypeFor(dialect, column, isKeyed(table, column));
    builder = builder.addColumn(column.name, sql.raw(type) as any, (col) => stated(col, column, composite, skip));
  }

  if (composite) {
    builder = builder.addPrimaryKeyConstraint(`${table.name}_pk`, table.compositePrimary as any);
  }

  for (const group of table.uniqueGroups) {
    builder = builder.addUniqueConstraint(`${table.name}_${group.join('_')}_unique`, group as any);
  }

  for (const column of table.columns) {
    const check = checkFor(column);
    if (check) builder = builder.addCheckConstraint(`${table.name}_${column.name}_check`, check);
  }

  return builder.compile().sql;
}

/** `CREATE INDEX` for one column that asked for one. */
export function indexSQL(table: TableDef, column: ColumnDef, dialectName: DialectName): string {
  return indexOver(table, [column.name], dialectName, column.unique === true);
}

/** Every index one table asks for, one statement each. */
export function createIndexSQL(table: TableDef, dialectName: DialectName): string[] {
  return [
    ...table.columns.filter((column) => column.index).map((column) => indexSQL(table, column, dialectName)),
    ...table.indexGroups.map((group) => indexOver(table, group, dialectName)),
  ];
}

function indexOver(
  table: TableDef,
  columns: readonly string[],
  dialectName: DialectName,
  unique = false,
): string {
  let builder = compiler(dialectName)
    .schema.createIndex(`${table.name}_${columns.join('_')}_idx`)
    .on(table.name)
    .columns([...columns]);
  if (unique) builder = builder.unique();
  if (dialectName !== 'mssql') builder = builder.ifNotExists();

  return builder.compile().sql;
}

/** `ALTER TABLE ADD CONSTRAINT` for one foreign key `orderTables` deferred. */
export function addForeignKeyConstraintSQL(table: TableDef, column: ColumnDef, dialectName: DialectName): string {
  const ref = column.references!;
  const name = `${table.name}_${column.name}_fk`;
  let builder = compiler(dialectName)
    .schema.alterTable(table.name)
    .addForeignKeyConstraint(name, [column.name], ref.table, [ref.column]);
  if (ref.onDelete) builder = builder.onDelete(ref.onDelete);

  return builder.compile().sql;
}


/** `CREATE TABLE` for every entity a source holds. */
export function generateSQL(view: SourceView, options?: GenerateOptions): string[] {
  const resolve = options?.tableName ?? toTableName;
  const dialect = options?.dialect ?? 'sqlite';
  const tables = toTables(view, resolve);

  if (dialect === 'sqlite') {
    return [
      ...tables.map((table) => createTableSQL(table, dialect)),
      ...tables.flatMap((table) => createIndexSQL(table, dialect)),
    ];
  }

  const { ordered, deferred } = orderTables(tables);
  const deferredColumnsOf = deferredColumnsByTable(deferred);

  const creates = ordered.map((table) =>
    createTableSQL(table, dialect, { skipReferences: deferredColumnsOf.get(table.name) }),
  );
  const constraints = deferred.map(({ table, column }) => addForeignKeyConstraintSQL(table, column, dialect));
  const indexes = ordered.flatMap((table) => createIndexSQL(table, dialect));

  return [...creates, ...constraints, ...indexes];
}

/** Anything that can run a statement, a raw better-sqlite3 handle included. */
export type SqlSink =
  | { execute(sql: string): unknown }
  | { exec(sql: string): unknown };

function runOn(sink: SqlSink, statement: string): unknown {
  return 'execute' in sink ? sink.execute(statement) : sink.exec(statement);
}

/** Create every missing table. */
export function autoMigrate(view: SourceView, sink: SqlSink, options?: GenerateOptions): void | Promise<void> {
  const pending = generateSQL(view, options)
    .map((statement) => runOn(sink, statement))
    .filter((result): result is Promise<unknown> => typeof (result as any)?.then === 'function');

  return pending.length ? Promise.all(pending).then(() => undefined) : undefined;
}

function stated(
  col: ColumnDefinitionBuilder,
  column: ColumnDef,
  composite: boolean,
  skip: ReadonlySet<string> | undefined,
): ColumnDefinitionBuilder {
  let built = col;
  if (column.primary && !composite) built = built.primaryKey();
  if (!column.nullable) built = built.notNull();
  if (column.default !== undefined) built = built.defaultTo(column.default);
  if (column.unique) built = built.unique();

  return column.references && !skip?.has(column.name) ? referencing(built, column.references) : built;
}

/** A column builder pointing at its target, with its `onDelete`. */
export function referencing(
  col: ColumnDefinitionBuilder,
  { table, column, onDelete }: NonNullable<ColumnDef['references']>,
): ColumnDefinitionBuilder {
  const built = col.references(`${table}.${column}`);

  return onDelete ? built.onDelete(onDelete) : built;
}
