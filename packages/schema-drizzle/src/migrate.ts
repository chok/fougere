/**
 * Auto-migrate — generate CREATE TABLE SQL from Entity classes.
 *
 * Reads scanned entities from an App, generates Drizzle tables,
 * and executes CREATE TABLE IF NOT EXISTS statements.
 */
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import type { SchemaLike } from '@fougere/schema';
import { toSqliteTable } from './sqlite.js';

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
function toTableName(name: string): string {
  const snake = name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  return snake + 's';
}

function columnToSQL(col: any): string {
  const parts: string[] = [col.name];

  switch (col.columnType) {
    case 'SQLiteText':
      parts.push('TEXT');
      break;
    case 'SQLiteInteger':
    case 'SQLiteBoolean':
      parts.push('INTEGER');
      break;
    case 'SQLiteReal':
      parts.push('REAL');
      break;
    default:
      parts.push('TEXT');
  }

  if (col.primary) parts.push('PRIMARY KEY');
  if (col.notNull) parts.push('NOT NULL');
  if (col.default !== undefined && col.default !== null) {
    const val = typeof col.default === 'string' ? `'${col.default}'` : col.default;
    parts.push(`DEFAULT ${val}`);
  }

  return parts.join(' ');
}

export interface MigrateOptions {
  /** Override table name resolution. Default: camelCase → snake_case + 's'. */
  tableName?: (entityName: string) => string;
}

/**
 * Generate CREATE TABLE IF NOT EXISTS SQL for all entities in the app —
 * scanned frond entities + auth runtime entities when present.
 */
export function generateSQL(app: AppLike, options?: MigrateOptions): string[] {
  const resolve = options?.tableName ?? toTableName;
  const statements: string[] = [];

  const emit = (entityName: string, entityClass: SchemaLike) => {
    const tableName = resolve(entityName);
    const table = toSqliteTable(tableName, entityClass as any);
    const config = getTableConfig(table);
    const columns = config.columns.map(columnToSQL);
    statements.push(
      `CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${columns.join(',\n  ')}\n);`,
    );
  };

  for (const frond of app.fronds) {
    for (const entity of frond.entities) emit(entity.name, entity.entityClass);
  }

  if (app.auth?.entities) {
    for (const [name, entityClass] of Object.entries(app.auth.entities)) {
      emit(name, entityClass);
    }
  }

  return statements;
}

/**
 * Auto-create tables from scanned entities.
 *
 * ```ts
 * autoMigrate(app, sqlite);
 * ```
 */
export function autoMigrate(
  app: AppLike,
  sqlite: { exec(sql: string): void },
  options?: MigrateOptions,
): void {
  const statements = generateSQL(app, options);
  for (const sql of statements) {
    sqlite.exec(sql);
  }
}
