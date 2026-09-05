/** DDL — the table description, rendered as SQL. */
import {
  Kysely,
  DummyDriver,
  sql,
  SqliteAdapter, SqliteQueryCompiler, SqliteIntrospector,
  PostgresAdapter, PostgresQueryCompiler, PostgresIntrospector,
  MysqlAdapter, MysqlQueryCompiler, MysqlIntrospector,
  MssqlAdapter, MssqlQueryCompiler, MssqlIntrospector,
} from 'kysely';
import {
  isKeyed,
  toTableName,
  toTables,
  type AppLike,
  type ColumnDef,
  type TableDef,
} from './table.js';
import { orderTables } from './order.js';
import { columnTypeFor, resolveDialect, type DialectName } from './dialect.js';
import { checkFor } from './check.js';

// ─── Compile-only engines ──────────────────────────

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

// ─── CREATE TABLE ──────────────────────────────────

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
    builder = builder.addColumn(column.name, sql.raw(type) as any, (col) => {
      let built = col;
      // A simple key is inline; a composite one becomes a table constraint.
      if (column.primary && !composite) built = built.primaryKey();
      if (!column.nullable) built = built.notNull();
      if (column.default !== undefined) built = built.defaultTo(column.default);
      // Uniqueness is the storage's to enforce: no shape can express it, since validating
      // one value never sees the other rows.
      if (column.unique) built = built.unique();
      if (column.references && !skip?.has(column.name)) {
        built = built.references(`${column.references.table}.${column.references.column}`);
        if (column.references.onDelete) built = built.onDelete(column.references.onDelete);
      }
      return built;
    });
  }

  if (composite) {
    builder = builder.addPrimaryKeyConstraint(`${table.name}_pk`, table.compositePrimary as any);
  }

  // The pair the entity declared. Named after its columns so a second group on the
  // same table cannot collide, and so a migration can recognize it later.
  for (const group of table.uniqueGroups) {
    builder = builder.addUniqueConstraint(`${table.name}_${group.join('_')}_unique`, group as any);
  }

  // What the shape says, told to the storage. Table-level rather than inline: a
  // named constraint is what a later migration can find and replace, and the same
  // form will hold a cross-field check when one is declared.
  for (const column of table.columns) {
    const check = checkFor(column);
    if (check) builder = builder.addCheckConstraint(`${table.name}_${column.name}_check`, check);
  }

  return builder.compile().sql;
}

/** `CREATE INDEX` for every column that asked for one. */
export function indexSQL(table: TableDef, column: ColumnDef, dialectName: DialectName): string {
  let builder = compiler(dialectName)
    .schema.createIndex(`${table.name}_${column.name}_idx`)
    .on(table.name)
    .column(column.name);
  if (dialectName !== 'mssql') builder = builder.ifNotExists();
  return builder.compile().sql;
}

/** Every index one table asks for — one statement each. */
export function createIndexSQL(table: TableDef, dialectName: DialectName): string[] {
  return table.columns
    .filter((column) => column.index)
    .map((column) => indexSQL(table, column, dialectName));
}

/**
 * `ALTER TABLE ADD CONSTRAINT` for one FK `orderTables` deferred — closes a relation cycle once
 * every table in it exists.
 */
export function addForeignKeyConstraintSQL(table: TableDef, column: ColumnDef, dialectName: DialectName): string {
  const ref = column.references!;
  const name = `${table.name}_${column.name}_fk`;
  let builder = compiler(dialectName)
    .schema.alterTable(table.name)
    .addForeignKeyConstraint(name, [column.name], ref.table, [ref.column]);
  if (ref.onDelete) builder = builder.onDelete(ref.onDelete);
  return builder.compile().sql;
}

// ─── App-wide generation ───────────────────────────

export interface GenerateOptions {
  /** Override table name resolution. Default: camelCase → snake_case + 's'. */
  tableName?: (entityName: string) => string;
  /** Target engine. Default: sqlite. */
  dialect?: DialectName;
}

/**
 * `CREATE TABLE` for every entity the app hosts — scanned frond entities plus auth runtime
 * entities when present.
 */
export function generateSQL(app: AppLike, options?: GenerateOptions): string[] {
  const resolve = options?.tableName ?? toTableName;
  const dialect = options?.dialect ?? 'sqlite';
  const tables = toTables(app, resolve);

  if (dialect === 'sqlite') {
    return [
      ...tables.map((table) => createTableSQL(table, dialect)),
      ...tables.flatMap((table) => createIndexSQL(table, dialect)),
    ];
  }

  const { ordered, deferred } = orderTables(tables);
  const deferredColumnsOf = new Map<string, Set<string>>();
  for (const { table, column } of deferred) {
    const names = deferredColumnsOf.get(table.name) ?? new Set<string>();
    names.add(column.name);
    deferredColumnsOf.set(table.name, names);
  }

  const creates = ordered.map((table) =>
    createTableSQL(table, dialect, { skipReferences: deferredColumnsOf.get(table.name) }),
  );
  const constraints = deferred.map(({ table, column }) => addForeignKeyConstraintSQL(table, column, dialect));
  // Indexes last: every table exists by then, and an index on a table that does not is
  // the one ordering mistake this pass can make.
  const indexes = ordered.flatMap((table) => createIndexSQL(table, dialect));
  return [...creates, ...constraints, ...indexes];
}

/**
 * Anything that can run a statement. `exec` is accepted alongside `execute` so a
 * raw better-sqlite3 handle drops in unchanged.
 */
export type SqlSink =
  | { execute(sql: string): unknown }
  | { exec(sql: string): unknown };

function runOn(sink: SqlSink, statement: string): unknown {
  return 'execute' in sink ? sink.execute(statement) : sink.exec(statement);
}

/** Create every missing table. */
export function autoMigrate(app: AppLike, sink: SqlSink, options?: GenerateOptions): void | Promise<void> {
  const pending = generateSQL(app, options)
    .map((statement) => runOn(sink, statement))
    .filter((result): result is Promise<unknown> => typeof (result as any)?.then === 'function');
  return pending.length ? Promise.all(pending).then(() => undefined) : undefined;
}
