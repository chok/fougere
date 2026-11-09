import { sql, type Kysely } from 'kysely';
import { type GenerateOptions } from '../ddl/GenerateOptions.js';
import { addForeignKeyConstraintSQL, compiler, createTableSQL, indexSQL, referencing } from '../ddl/SqlSink.js';
import { checkFor } from '../check.js';
import { columnTypeFor, resolveDialect } from '../dialect/Dialect.js';
import { type DialectName } from '../dialect/DialectName.js';
import type { SourceView } from '@fougere/core';
import { type ColumnDef } from '../table/ColumnDef.js';
import { isKeyed, toTableName, toTables, type TableDef } from '../table/TableDef.js';
import { deferredColumnsByTable, orderTables } from '../order/TableOrder.js';
import { actualTypes, type ColumnTypes } from './ColumnTypes.js';
import { actualState, namesOf, type SchemaState } from './SchemaState.js';

/** Project a source's entities into the tables they ask for. */
export function desiredTables(view: SourceView, options?: GenerateOptions): TableDef[] {
  return toTables(view, options?.tableName ?? toTableName);
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
  for (const table of desired) {
    for (const column of table.columns) {
      if (column.index || (column.unique && !column.primary)) changes.push({ kind: 'createIndex', table, column });
    }
  }

  return changes;
}

/** The changes `delta` found, in the order this dialect needs. */
export function orderChanges(changes: Change[], dialectName: DialectName): Change[] {
  if (dialectName === 'sqlite') return changes;

  const creates = changes.filter((c): c is Extract<Change, { kind: 'createTable' }> => c.kind === 'createTable');
  const addColumns = changes.filter((c) => c.kind === 'addColumn');
  const indexes = changes.filter((c) => c.kind === 'createIndex');

  const { ordered, deferred } = orderTables(creates.map((c) => c.table));
  const deferredColumnsOf = deferredColumnsByTable(deferred);

  const createChanges: Change[] = ordered.map((table) => {
    const names = deferredColumnsOf.get(table.name);

    return names ? { kind: 'createTable', table, deferredColumns: [...names] } : { kind: 'createTable', table };
  });
  const constraintChanges: Change[] = deferred.map(({ table, column }) => ({ kind: 'addConstraint', table, column }));

  return [...createChanges, ...constraintChanges, ...addColumns, ...indexes];
}

/** Render one change. */
export function changeSQL(change: Change, dialectName: DialectName): string {
  const dialect = resolveDialect(dialectName);
  if (change.kind === 'createTable') {
    const skip = change.deferredColumns ? new Set(change.deferredColumns) : undefined;

    return createTableSQL(change.table, dialectName, { skipReferences: skip });
  }
  if (change.kind === 'addConstraint') {
    return addForeignKeyConstraintSQL(change.table, change.column, dialectName);
  }
  if (change.kind === 'createIndex') {
    return indexSQL(change.table, change.column, dialectName);
  }
  const { table, column } = change;
  const type = columnTypeFor(dialect, column, isKeyed(table, column));

  return compiler(dialectName)
    .schema.alterTable(table.name)
    .addColumn(column.name, sql.raw(type) as any, (col) => {
      let built = col;
      if (column.default !== undefined) built = built.defaultTo(column.default);
      if (!column.nullable) built = built.notNull();
      if (column.references) built = referencing(built, column.references);
      const check = checkFor(column);
      if (check) built = built.check(check);

      return built;
    })
    .compile().sql;
}

/** Everything the database is missing, as statements ready to run. */
export async function planMigration(
  view: SourceView,
  db: Kysely<any>,
  options?: GenerateOptions,
): Promise<{ changes: Change[]; statements: string[] }> {
  const dialect = options?.dialect ?? 'sqlite';
  const changes = orderChanges(delta(desiredTables(view, options), await actualState(db)), dialect);

  return { changes, statements: changes.map((change) => changeSQL(change, dialect)) };
}

/** Bring the database up to what the entities describe — additively. */
export async function migrate(
  view: SourceView,
  target: Kysely<any> | { db: Kysely<any> },
  options?: GenerateOptions,
): Promise<Change[]> {
  const db = (target as { db?: Kysely<any> }).db ?? (target as Kysely<any>);
  const { changes, statements } = await planMigration(view, db, options);
  for (const statement of statements) {
    await sql.raw(statement).execute(db);
  }

  return changes;
}

/** The tables and columns the database lacks, read and never written. */
export async function pendingOf(view: SourceView, db: Kysely<any>, options?: GenerateOptions): Promise<string[]> {
  const desired = desiredTables({ entities: view.entities }, options);
  const live = await actualTypes(db);
  const missing = delta(desired, namesOf(live)).flatMap((change) => {
    if (change.kind === 'createTable') return [`${change.table.name} — no table`];
    if (change.kind === 'addColumn') return [`${change.table.name}.${change.column.name} — no column`];

    return [];
  });

  return [...missing, ...untypedUuids(desired, live, options?.dialect)];
}

function untypedUuids(desired: TableDef[], live: ColumnTypes, dialect: DialectName = 'sqlite'): string[] {
  const engine = resolveDialect(dialect);

  return desired.flatMap((table) => table.columns.flatMap((column) => {
    const held = live.get(table.name)?.get(column.name);
    if (held === undefined || held === 'uuid') return [];
    if (columnTypeFor(engine, column, isKeyed(table, column)) !== 'uuid') return [];

    return [
      `${table.name}.${column.name} — ${held}, where the entity stores a uuid: convert the column, `
      + "or keep the ids it holds with primary({ generate: 'cuid2' })",
    ];
  }));
}

/** The columns a live table keeps that no field declares, for the tables that also gain one. */
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
