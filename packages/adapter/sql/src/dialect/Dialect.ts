import type { ColumnDef } from '../table/ColumnDef.js';
import type { DialectName } from './DialectName.js';

export interface Dialect {
  name: DialectName;
  /** SQL type for a column. */
  columnType(column: ColumnDef, keyed: boolean): string;
  /** Whether `INSERT … RETURNING` works; otherwise an insert is followed by a select. */
  supportsReturning: boolean;
  /** How many values one statement may bind — what splits a batch read into several. */
  maxBindings: number;
  /** How this engine spells "write it, or replace what is there". */
  upsert: 'on conflict' | 'on duplicate key' | false;
  /** Is this the engine refusing a duplicate, rather than failing? */
  isUniqueViolation(error: unknown): boolean;
  /** How a transaction holds a row: `for update` on the read, or `touch`, an update writing the key onto itself. */
  rowLock: 'for update' | 'touch';
  /** Did the engine give up on this transaction for another one — a deadlock, a lock it waited too long for? */
  isContention(error: unknown): boolean;
}

function messageOf(error: unknown): string {
  const e = error as { message?: unknown; code?: unknown; cause?: unknown } | null;
  const own = `${typeof e?.message === 'string' ? e.message : ''} ${typeof e?.code === 'string' ? e.code : ''}`;

  return e?.cause ? `${own} ${messageOf(e.cause)}` : own;
}

const KEY_LENGTH = 255;

function keyLength(column: ColumnDef): number {
  const declared = column.bounds?.maxLength;

  return declared !== undefined && declared > 0 && declared <= KEY_LENGTH ? declared : KEY_LENGTH;
}

export const sqliteDialect: Dialect = {
  isUniqueViolation: (error) => /UNIQUE constraint failed/i.test(messageOf(error)),
  upsert: 'on conflict',
  rowLock: 'touch',
  isContention: (error) => /SQLITE_BUSY|database is locked/i.test(messageOf(error)),
  maxBindings: 30000,
  name: 'sqlite',
  supportsReturning: true,
  columnType(column) {
    switch (column.type) {
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
  isUniqueViolation: (error) => /23505/.test(messageOf(error)),
  upsert: 'on conflict',
  rowLock: 'for update',
  isContention: (error) => /\b40P01\b|\b40001\b/.test(messageOf(error)),
  maxBindings: 60000,
  name: 'pg',
  supportsReturning: true,
  columnType(column) {
    if (column.uuid) return 'uuid';
    switch (column.type) {
      case 'integer':
        return 'integer';
      case 'number':
        return 'double precision';
      case 'boolean':
        return 'boolean';
      case 'date':
        return 'timestamptz';
      case 'object':
      case 'array':
        return 'jsonb';
      default:
        return 'text';
    }
  },
};

export const mysqlDialect: Dialect = {
  isUniqueViolation: (error) => /ER_DUP_ENTRY|Duplicate entry/i.test(messageOf(error)),
  upsert: 'on duplicate key',
  rowLock: 'for update',
  isContention: (error) => /ER_LOCK_DEADLOCK|ER_LOCK_WAIT_TIMEOUT/.test(messageOf(error)),
  maxBindings: 60000,
  name: 'mysql',
  supportsReturning: false,
  columnType(column, keyed) {
    switch (column.type) {
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
        return keyed ? `varchar(${keyLength(column)})` : 'text';
    }
  },
};

export const mssqlDialect: Dialect = {
  isUniqueViolation: (error) => /\b(2627|2601)\b|Violation of UNIQUE KEY/i.test(messageOf(error)),
  upsert: false,
  rowLock: 'touch',
  isContention: (error) => /\b1205\b|deadlocked/i.test(messageOf(error)),
  maxBindings: 2000,
  name: 'mssql',
  supportsReturning: false,
  columnType(column, keyed) {
    switch (column.type) {
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

/** The type a column is emitted with: what the entity stated for this engine, else the shape's answer. */
export function columnTypeFor(dialect: Dialect, column: ColumnDef, keyed: boolean): string {
  return column.stated?.columnType?.[dialect.name] ?? dialect.columnType(column, keyed);
}
