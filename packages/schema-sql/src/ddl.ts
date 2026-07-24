/**
 * DDL — the table description, rendered as SQL.
 *
 * Kysely's schema builder is what makes this dialect-agnostic: it owns the
 * identifier quoting and the per-engine syntax, so this module only decides
 * *what* to emit. Compilation needs no connection — a `DummyDriver` paired with
 * a real query compiler renders the statement for any engine, which is why the
 * whole surface is testable without a database.
 */
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
  orderTables,
  toTableName,
  toTables,
  type AppLike,
  type ColumnDef,
  type TableDef,
} from './table.js';
import { resolveDialect, type DialectName } from './dialect.js';

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

/**
 * Render `CREATE TABLE` for one described table.
 *
 * `IF NOT EXISTS` is emitted everywhere it exists — SQL Server has no such
 * clause, so there the statement is bare and the caller must not replay it
 * blindly (the diff pass, once it lands, answers that properly).
 *
 * `skipReferences` names the columns whose FK is rendered WITHOUT the inline
 * `references()` — the column itself still gets created; `orderTables` sends a
 * column here when its target is part of a cycle, so the constraint reaches the
 * table separately, once every table involved exists (`addForeignKeyConstraintSQL`).
 */
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
    const type = dialect.columnType(column, isKeyed(table, column));
    builder = builder.addColumn(column.name, sql.raw(type) as any, (col) => {
      let built = col;
      // A simple key is inline; a composite one becomes a table constraint.
      if (column.primary && !composite) built = built.primaryKey();
      if (!column.nullable) built = built.notNull();
      if (column.default !== undefined) built = built.defaultTo(column.default);
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

  return builder.compile().sql;
}

/**
 * `ALTER TABLE ADD CONSTRAINT` for one FK `orderTables` deferred — closes a
 * relation cycle once every table in it exists. Not available on SQLite (its
 * `ALTER TABLE` is limited to RENAME/ADD COLUMN/RENAME COLUMN/DROP COLUMN) — a
 * caller on that dialect never produces a deferred edge to render here.
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
 * `CREATE TABLE` for every entity the app hosts — scanned frond entities plus
 * auth runtime entities when present.
 *
 * SQLite resolves FK targets lazily and accepts any order, and it has no
 * `ALTER TABLE ADD CONSTRAINT` to close a cycle with — every FK stays inline,
 * unordered. Every other engine needs a referenced table to exist first:
 * `orderTables` sorts the batch and reports the edges a cycle forces to defer,
 * rendered as `ALTER TABLE ADD CONSTRAINT` after every `CREATE TABLE`.
 *
 * Caveat for a repeat call (`autoMigrate`): `CREATE TABLE IF NOT EXISTS` is
 * idempotent, `ADD CONSTRAINT` is not — on pg/mysql/mssql, calling this twice
 * for an app with a relation cycle re-issues the same constraint and errors.
 * The introspection-based `migrate()` (`diff.ts`) doesn't have this problem: it
 * only ever emits a table's constraints once, the run that creates it.
 */
export function generateSQL(app: AppLike, options?: GenerateOptions): string[] {
  const resolve = options?.tableName ?? toTableName;
  const dialect = options?.dialect ?? 'sqlite';
  const tables = toTables(app, resolve);

  if (dialect === 'sqlite') {
    return tables.map((table) => createTableSQL(table, dialect));
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
  return [...creates, ...constraints];
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

/**
 * Create every missing table. Additive only — an existing table is left alone.
 *
 * Stays SYNCHRONOUS when the sink is (a raw better-sqlite3 handle), so a caller
 * that doesn't await still gets its tables before the next statement. Returns a
 * promise only when the sink actually returns one.
 */
export function autoMigrate(app: AppLike, sink: SqlSink, options?: GenerateOptions): void | Promise<void> {
  const pending = generateSQL(app, options)
    .map((statement) => runOn(sink, statement))
    .filter((result): result is Promise<unknown> => typeof (result as any)?.then === 'function');
  return pending.length ? Promise.all(pending).then(() => undefined) : undefined;
}
