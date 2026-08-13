/**
 * Dialect — the only place that speaks SQL.
 *
 * A dialect answers two questions and nothing else: which column type carries
 * this shape, and does this engine support `RETURNING`. Everything structural
 * (which columns exist, which are keys) is decided upstream in `TableDef`.
 */
import type { ColumnDef } from './table.js';

export type DialectName = 'sqlite' | 'pg' | 'mysql' | 'mssql';

export interface Dialect {
  name: DialectName;
  /**
   * SQL type for a column. `keyed` is true when the column belongs to a primary
   * key — MySQL and SQL Server cannot index an unbounded text column, so they
   * narrow to a bounded varchar there.
   */
  columnType(column: ColumnDef, keyed: boolean): string;
  /**
   * Does `INSERT … RETURNING` work? MySQL has no such clause and SQL Server
   * spells it `OUTPUT`; both take the insert-then-select path instead.
   */
  supportsReturning: boolean;
}

/** Bounded length for a key column, when the shape doesn't state its own. */
const KEY_LENGTH = 255;

function keyLength(column: ColumnDef): number {
  const declared = column.shape?.maxLength;
  return declared !== undefined && declared > 0 && declared <= KEY_LENGTH ? declared : KEY_LENGTH;
}

export const sqliteDialect: Dialect = {
  name: 'sqlite',
  supportsReturning: true,
  // SQLite has one integer, one float and one text type — a boolean is an int,
  // JSON is text. Any column may be a key, so `keyed` changes nothing.
  columnType(column) {
    switch (column.shape?.type) {
      case 'integer':
      case 'boolean':
        return 'integer';
      case 'number':
        return 'real';
      default:
        return 'text';
    }
  },
};

export const pgDialect: Dialect = {
  name: 'pg',
  supportsReturning: true,
  // Postgres has real types for everything, and `text` is indexable — so a key
  // needs no narrowing.
  columnType(column) {
    switch (column.shape?.type) {
      case 'integer':
        return 'integer';
      case 'number':
        return 'double precision';
      case 'boolean':
        return 'boolean';
      case 'object':
      case 'array':
        return 'jsonb';
      default:
        return 'text';
    }
  },
};

export const mysqlDialect: Dialect = {
  name: 'mysql',
  supportsReturning: false,
  columnType(column, keyed) {
    switch (column.shape?.type) {
      case 'integer':
        return 'int';
      case 'number':
        return 'double';
      case 'boolean':
        return 'boolean';
      case 'object':
      case 'array':
        return 'json';
      default:
        // TEXT cannot take part in a key without a prefix length.
        return keyed ? `varchar(${keyLength(column)})` : 'text';
    }
  },
};

export const mssqlDialect: Dialect = {
  name: 'mssql',
  supportsReturning: false,
  columnType(column, keyed) {
    switch (column.shape?.type) {
      case 'integer':
        return 'int';
      case 'number':
        return 'float';
      case 'boolean':
        return 'bit';
      case 'object':
      case 'array':
        return 'nvarchar(max)';
      default:
        // nvarchar(max) is not indexable — a key narrows to a bounded length.
        return keyed ? `nvarchar(${keyLength(column)})` : 'nvarchar(max)';
    }
  },
};

export const dialects: Record<DialectName, Dialect> = {
  sqlite: sqliteDialect,
  pg: pgDialect,
  mysql: mysqlDialect,
  mssql: mssqlDialect,
};

export function resolveDialect(name: DialectName): Dialect {
  const dialect = dialects[name];
  if (!dialect) throw new Error(`Unknown SQL dialect '${name}'. Known: ${Object.keys(dialects).join(', ')}`);
  return dialect;
}
