/**
 * Diff — what the database is missing, compared to what the entities describe.
 *
 * Two states, one comparison, one realisation. The desired state comes from the
 * entities; the actual one from Kysely's introspection, which is already
 * engine-agnostic. The comparison itself is pure — no IO, no SQL.
 *
 * ADDITIVE ONLY, and that incapacity is the guarantee: a missing table is
 * created, a missing column is added, and **nothing else ever happens**. Drops,
 * renames and type changes are human intentions — a rename is not even
 * detectable from a diff (it reads as a drop plus an add). Those belong in a
 * written migration, never in an automatic pass.
 */
import { sql, type Kysely } from 'kysely';
import type { SchemaLike } from '@fougere/schema';
import { compiler, createTableSQL, toTableName, type GenerateOptions } from './ddl.js';
import { resolveDialect, type DialectName } from './dialect.js';
import { isKeyed, toTable, type ColumnDef, type TableDef } from './table.js';

/** What the database actually holds: column names per table. */
export type SchemaState = Map<string, Set<string>>;

interface EntityEntry {
  name: string;
  entityClass: SchemaLike;
}

interface AppLike {
  fronds: { name: string; entities: EntityEntry[] }[];
  auth?: { entities: Record<string, SchemaLike> };
}

/** Read the live schema. Only names are needed — an additive pass never inspects types. */
export async function actualState(db: Kysely<any>): Promise<SchemaState> {
  const state: SchemaState = new Map();
  for (const table of await db.introspection.getTables()) {
    if (table.isView) continue;
    state.set(table.name, new Set(table.columns.map((column) => column.name)));
  }
  return state;
}

/** Project the app's entities into the tables they ask for. */
export function desiredTables(app: AppLike, options?: GenerateOptions): TableDef[] {
  const resolve = options?.tableName ?? toTableName;
  const tables: TableDef[] = [];
  for (const frond of app.fronds) {
    for (const entity of frond.entities) tables.push(toTable(resolve(entity.name), entity.entityClass));
  }
  if (app.auth?.entities) {
    for (const [name, entityClass] of Object.entries(app.auth.entities)) {
      tables.push(toTable(resolve(name), entityClass));
    }
  }
  return tables;
}

export type Change =
  | { kind: 'createTable'; table: TableDef }
  | { kind: 'addColumn'; table: TableDef; column: ColumnDef };

/** Compare the two states. Pure — the only place that decides what is missing. */
export function delta(desired: TableDef[], actual: SchemaState): Change[] {
  const changes: Change[] = [];
  for (const table of desired) {
    const existing = actual.get(table.name);
    if (!existing) {
      changes.push({ kind: 'createTable', table });
      continue;
    }
    for (const column of table.columns) {
      if (!existing.has(column.name)) changes.push({ kind: 'addColumn', table, column });
    }
  }
  return changes;
}

/**
 * Render one change.
 *
 * A column added to a populated table cannot be `NOT NULL` without a default —
 * every engine refuses it. So an added column keeps its `NOT NULL` only when a
 * default answers the existing rows; otherwise it lands nullable, and tightening
 * it is a written migration.
 */
export function changeSQL(change: Change, dialectName: DialectName): string {
  const dialect = resolveDialect(dialectName);
  if (change.kind === 'createTable') {
    // Reuse the same renderer as a fresh install — one builder, no drift.
    return createTableSQL(change.table, dialectName);
  }
  const { table, column } = change;
  const type = dialect.columnType(column, isKeyed(table, column));
  return compiler(dialectName)
    .schema.alterTable(table.name)
    .addColumn(column.name, sql.raw(type) as any, (col) => {
      let built = col;
      if (column.default !== undefined) {
        built = built.defaultTo(column.default);
        if (!column.nullable) built = built.notNull();
      }
      return built;
    })
    .compile().sql;
}

/** Everything the database is missing, as statements ready to run. */
export async function planMigration(
  app: AppLike,
  db: Kysely<any>,
  options?: GenerateOptions,
): Promise<{ changes: Change[]; statements: string[] }> {
  const dialect = options?.dialect ?? 'sqlite';
  const changes = delta(desiredTables(app, options), await actualState(db));
  return { changes, statements: changes.map((change) => changeSQL(change, dialect)) };
}

/**
 * Bring the database up to what the entities describe — additively.
 *
 * Returns what it did, so a caller can log or refuse. Replaces the old
 * create-if-not-exists pass: it also catches a field added to an existing entity,
 * which used to be silently ignored.
 */
export async function migrate(
  app: AppLike,
  db: Kysely<any>,
  options?: GenerateOptions,
): Promise<Change[]> {
  const { changes, statements } = await planMigration(app, db, options);
  for (const statement of statements) {
    await sql.raw(statement).execute(db);
  }
  return changes;
}
