import { sql, type Kysely } from 'kysely';
import { type GenerateOptions } from '../ddl/GenerateOptions.js';
import { addForeignKeyConstraintSQL, compiler, createTableSQL, indexSQL } from '../ddl/SqlSink.js';
import { checkFor } from '../check.js';
import { columnTypeFor, resolveDialect } from '../dialect/Dialect.js';
import { type DialectName } from '../dialect/DialectName.js';
import { type AppLike } from '../table/AppLike.js';
import { type ColumnDef } from '../table/ColumnDef.js';
import { isKeyed, toTableName, toTables, type TableDef } from '../table/TableDef.js';
import { orderTables } from '../order/TableOrder.js';
import type { SchemaState } from './SchemaState.js';

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
  //
  // `unique` comes here too, and for that very reason: written as a column constraint it
  // only ever reached a table being created, so the rule was declared and never realized on
  // a database that had already lived. A unique index is the one form that can arrive late.
  for (const table of desired) {
    for (const column of table.columns) {
      if (column.index || (column.unique && !column.primary)) changes.push({ kind: 'createIndex', table, column });
    }
  }

  return changes;
}

/**
 * Order the changes `delta` found, dialect-aware — `delta` itself stays pure and unordered, this
 * is the one place that adds engine knowledge to the plan.
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

/** Render one change. */
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
  const type = columnTypeFor(dialect, column, isKeyed(table, column));

  return compiler(dialectName)
    .schema.alterTable(table.name)
    .addColumn(column.name, sql.raw(type) as any, (col) => {
      let built = col;
      if (column.default !== undefined) built = built.defaultTo(column.default);
      // Stated whether a default fills it or not: the same declaration gave NOT NULL on a
      // fresh table and nothing on a migrated one, so two databases of one entity promised
      // different things. Without a default the engine refuses on a table holding rows —
      // which is the refusal `planStep` already names, arriving here instead of never.
      if (!column.nullable) built = built.notNull();
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

/** Bring the database up to what the entities describe — additively. */
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

/**
 * What the database lacks that the entities ask for, READ and never written — a table, a
 * column. Indexes are left out: this pass reads names, and `CREATE INDEX IF NOT EXISTS` is
 * what `migrate` proposes every time precisely because nothing here can see one.
 */
export async function pendingOf(app: AppLike, db: Kysely<any>, options?: GenerateOptions): Promise<string[]> {
  // Names only, so `elsewhere` is left out: it decides which relations get a foreign key, and
  // a process carrying only its own frond refers to entities it has never seen — which a
  // question about names has no reason to refuse.
  const desired = desiredTables({ ...app, elsewhere: undefined }, options);

  return delta(desired, await actualState(db)).flatMap((change) => {
    if (change.kind === 'createTable') return [`${change.table.name} — no table`];
    if (change.kind === 'addColumn') return [`${change.table.name}.${change.column.name} — no column`];

    return [];
  });
}

/**
 * The columns a live table keeps that no field declares, for the tables that also GAIN one —
 * which is what an undeclared rename looks like: the data stays in a column nothing reads.
 */
export function undeclaredColumns(desired: TableDef[], actual: SchemaState): { table: string; columns: string[]; added: string[] }[] {
  return desired.flatMap((table) => {
    const live = actual.get(table.name);
    if (!live) return [];
    const declared = new Set(table.columns.map((column) => column.name));
    const columns = [...live].filter((name) => !declared.has(name));
    const added = table.columns.map((column) => column.name).filter((name) => !live.has(name));

    return columns.length > 0 && added.length > 0 ? [{ table: table.name, columns, added }] : [];
  });
}
