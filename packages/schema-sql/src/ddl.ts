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
import type { SchemaLike } from '@fougere/schema';
import { resolveDialect, type DialectName } from './dialect.js';
import { isKeyed, toTable, type TableDef } from './table.js';

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
 */
export function createTableSQL(table: TableDef, dialectName: DialectName): string {
  const dialect = resolveDialect(dialectName);
  const composite = table.compositePrimary.length > 0;
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
      return built;
    });
  }

  if (composite) {
    builder = builder.addPrimaryKeyConstraint(`${table.name}_pk`, table.compositePrimary as any);
  }

  return builder.compile().sql;
}

// ─── App-wide generation ───────────────────────────

interface EntityEntry {
  name: string;
  entityClass: SchemaLike;
}

interface FrondLike {
  name: string;
  entities: EntityEntry[];
}

interface AppLike {
  fronds: FrondLike[];
  /** Auth runtime entities are migrated alongside scanned fronds when present. */
  auth?: { entities: Record<string, SchemaLike> };
}

/** camelCase → snake_case + plural */
export function toTableName(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`) + 's';
}

export interface GenerateOptions {
  /** Override table name resolution. Default: camelCase → snake_case + 's'. */
  tableName?: (entityName: string) => string;
  /** Target engine. Default: sqlite. */
  dialect?: DialectName;
}

/**
 * `CREATE TABLE` for every entity the app hosts — scanned frond entities plus
 * auth runtime entities when present.
 */
export function generateSQL(app: AppLike, options?: GenerateOptions): string[] {
  const resolve = options?.tableName ?? toTableName;
  const dialect = options?.dialect ?? 'sqlite';
  const statements: string[] = [];

  const emit = (entityName: string, entityClass: SchemaLike) => {
    statements.push(createTableSQL(toTable(resolve(entityName), entityClass), dialect));
  };

  for (const frond of app.fronds) {
    for (const entity of frond.entities) emit(entity.name, entity.entityClass);
  }
  if (app.auth?.entities) {
    for (const [name, entityClass] of Object.entries(app.auth.entities)) emit(name, entityClass);
  }

  return statements;
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
