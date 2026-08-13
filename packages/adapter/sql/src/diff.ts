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
import { addForeignKeyConstraintSQL, compiler, createTableSQL, indexSQL, type GenerateOptions } from './ddl.js';
import { checkFor } from './check.js';
import { resolveDialect, type DialectName } from './dialect.js';
import {
  isKeyed,
  orderTables,
  toTables,
  toTableName,
  type AppLike,
  type ColumnDef,
  type TableDef,
} from './table.js';

/** What the database actually holds: column names per table. */
export type SchemaState = Map<string, Set<string>>;

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
  return toTables(app, options?.tableName ?? toTableName);
}

export type Change =
  | { kind: 'createTable'; table: TableDef; deferredColumns?: string[] }
  | { kind: 'addColumn'; table: TableDef; column: ColumnDef }
  | { kind: 'addConstraint'; table: TableDef; column: ColumnDef }
  | { kind: 'createIndex'; table: TableDef; column: ColumnDef };

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
  // Indexes, unconditionally: this pass reads column NAMES from the live schema, so it
  // cannot see whether an index exists. `CREATE INDEX IF NOT EXISTS` is idempotent, so
  // proposing it every time is cheaper and more honest than introspecting to guess —
  // the alternative would be an index that a `unique()` added later never gets.
  for (const table of desired) {
    for (const column of table.columns) {
      if (column.index) changes.push({ kind: 'createIndex', table, column });
    }
  }
  return changes;
}

/**
 * Order the changes `delta` found, dialect-aware — `delta` itself stays pure and
 * unordered, this is the one place that adds engine knowledge to the plan.
 *
 * SQLite resolves FK targets lazily and accepts any order, with no `ALTER TABLE
 * ADD CONSTRAINT` to defer to — changes pass through unchanged. Every other
 * engine needs a `createTable`'s FK targets to already exist: `orderTables`
 * sorts the NEW tables among themselves and reports the edges a cycle forces to
 * defer as `addConstraint` changes. An `addColumn` always lands last — its
 * table already exists (that's why it's `addColumn` and not `createTable`), but
 * its FK target might be one of THIS batch's new tables, so it waits until
 * every `createTable`/`addConstraint` above it has run.
 */
export function orderChanges(changes: Change[], dialectName: DialectName): Change[] {
  if (dialectName === 'sqlite') return changes;

  const creates = changes.filter((c): c is Extract<Change, { kind: 'createTable' }> => c.kind === 'createTable');
  const addColumns = changes.filter((c) => c.kind === 'addColumn');
  const indexes = changes.filter((c) => c.kind === 'createIndex');

  const { ordered, deferred } = orderTables(creates.map((c) => c.table));
  const deferredColumnsOf = new Map<string, Set<string>>();
  for (const { table, column } of deferred) {
    const names = deferredColumnsOf.get(table.name) ?? new Set<string>();
    names.add(column.name);
    deferredColumnsOf.set(table.name, names);
  }

  const createChanges: Change[] = ordered.map((table) => {
    const names = deferredColumnsOf.get(table.name);
    return names ? { kind: 'createTable', table, deferredColumns: [...names] } : { kind: 'createTable', table };
  });
  const constraintChanges: Change[] = deferred.map(({ table, column }) => ({ kind: 'addConstraint', table, column }));

  // Indexes last: the column they stand on may be one this very batch added.
  return [...createChanges, ...constraintChanges, ...addColumns, ...indexes];
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
    const skip = change.deferredColumns ? new Set(change.deferredColumns) : undefined;
    return createTableSQL(change.table, dialectName, { skipReferences: skip });
  }
  if (change.kind === 'addConstraint') {
    return addForeignKeyConstraintSQL(change.table, change.column, dialectName);
  }
  if (change.kind === 'createIndex') {
    // One statement per change — `migrate` runs them one by one, and no driver here
    // accepts a batch.
    return indexSQL(change.table, change.column, dialectName);
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
      if (column.references) {
        built = built.references(`${column.references.table}.${column.references.column}`);
        if (column.references.onDelete) built = built.onDelete(column.references.onDelete);
      }
      // Inline rather than a named table constraint: SQLite cannot ALTER one in, and
      // the column is new, so no existing row can be caught out by it. A column that
      // arrives later is bounded like a column that was there from the start.
      const check = checkFor(column);
      if (check) built = built.check(check);
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
  const changes = orderChanges(delta(desiredTables(app, options), await actualState(db)), dialect);
  return { changes, statements: changes.map((change) => changeSQL(change, dialect)) };
}

/**
 * Bring the database up to what the entities describe — additively.
 *
 * Returns what it did, so a caller can log or refuse. Replaces the old
 * create-if-not-exists pass: it also catches a field added to an existing entity,
 * which used to be silently ignored.
 */
/**
 * Bring the schema up to date. Takes the setup itself — `migrate(app, setup)` — so the
 * common case never has to reach into `setup.db`, the one handle that meets no judge.
 * A bare Kysely instance is still accepted, for a caller who holds only that.
 */
export async function migrate(
  app: AppLike,
  target: Kysely<any> | { db: Kysely<any> },
  options?: GenerateOptions,
): Promise<Change[]> {
  const db = (target as { db?: Kysely<any> }).db ?? (target as Kysely<any>);
  const { changes, statements } = await planMigration(app, db, options);
  for (const statement of statements) {
    await sql.raw(statement).execute(db);
  }
  return changes;
}
