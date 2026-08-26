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
  /**
   * How many values one statement may bind — what splits a batch read into several.
   *
   * A key set comes from a PAGE, and a page has no ceiling (`list()` with no limit
   * reads the table), so `where id in (…)` eventually meets the engine's limit.
   * Measured on SQLite: 32 766 binds, and 32 767 answers `too many SQL variables`.
   * SQL Server is the low one at 2100, which is why this is per dialect and not one
   * constant — a batch that works on SQLite and dies on SQL Server is the same value
   * behaving differently per engine, the thing this file exists to absorb.
   *
   * The number below is the limit MINUS a margin for the other values a statement
   * carries (a filter, a cursor): a batch read is never the only thing in the query.
   */
  maxBindings: number;
  /**
   * How this engine spells "write it, or replace what is there".
   *
   * `'on conflict'` is the standard clause (SQLite, Postgres); MySQL spells the same
   * thing `ON DUPLICATE KEY UPDATE`; SQL Server has only `MERGE`, a different statement
   * with different semantics — so it answers `false` and the port refuses by name
   * rather than emulating a write with a read in front of it, which would be a lie
   * about atomicity in an engine that has no transaction here either.
   */
  upsert: 'on conflict' | 'on duplicate key' | false;
  /**
   * Is this the engine refusing a duplicate, rather than failing?
   *
   * A driver reports it as a plain `Error` whose wording is the engine's own, so only a
   * dialect can tell — the same reason `maxBindings` and `upsert` live here. Without it
   * every engine's phrasing would be matched in one place, and this file exists so no
   * other one learns a dialect.
   *
   * A false negative costs an INTERNAL_ERROR where a CONFLICT was due — which is what
   * every engine answered before this existed, so nothing is made worse by a gap.
   */
  isUniqueViolation(error: unknown): boolean;
}

/** The message a driver hands up, however it wrapped it. */
function messageOf(error: unknown): string {
  const e = error as { message?: unknown; code?: unknown; cause?: unknown } | null;
  const own = `${typeof e?.message === 'string' ? e.message : ''} ${typeof e?.code === 'string' ? e.code : ''}`;
  // Kysely wraps a driver error, and D1 wraps it again: the wording is often one level down.
  return e?.cause ? `${own} ${messageOf(e.cause)}` : own;
}

/** Bounded length for a key column, when the shape doesn't state its own. */
const KEY_LENGTH = 255;

function keyLength(column: ColumnDef): number {
  const declared = column.bounds?.maxLength;
  return declared !== undefined && declared > 0 && declared <= KEY_LENGTH ? declared : KEY_LENGTH;
}

export const sqliteDialect: Dialect = {
  // SQLite: `UNIQUE constraint failed: products.sku` — and D1 relays it verbatim.
  isUniqueViolation: (error) => /UNIQUE constraint failed/i.test(messageOf(error)),
  upsert: 'on conflict',
  // SQLITE_MAX_VARIABLE_NUMBER is 32766 on any build since 3.32 (measured on better-sqlite3).
  maxBindings: 30000,
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
  // Postgres: SQLSTATE 23505, which `pg` puts on `code` — the one engine that names it
  // in a way no translation can blur.
  isUniqueViolation: (error) => /23505/.test(messageOf(error)),
  upsert: 'on conflict',
  // the wire protocol counts parameters in an int16 — 65535.
  maxBindings: 60000,
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
  // MySQL: ER_DUP_ENTRY / 1062, `Duplicate entry '…' for key '…'`.
  isUniqueViolation: (error) => /ER_DUP_ENTRY|Duplicate entry/i.test(messageOf(error)),
  upsert: 'on duplicate key',
  // no parameter ceiling of its own; max_allowed_packet is what gives way, and it grows with the VALUES not the count.
  maxBindings: 60000,
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
  // SQL Server: 2627 for a constraint, 2601 for a unique index — two numbers, one fact.
  isUniqueViolation: (error) => /\b(2627|2601)\b|Violation of UNIQUE KEY/i.test(messageOf(error)),
  upsert: false,
  // 2100 parameters per statement, the lowest of the four by a wide margin.
  maxBindings: 2000,
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

/**
 * The type this column is emitted with — the entity's preference when it stated one for
 * THIS engine, the shape's own answer otherwise.
 *
 * The fallback is what makes a hint a hint: `columnType: { pg: 'tsvector' }` leaves
 * SQLite exactly where it was, so the same entity still boots on every dialect.
 */
export function columnTypeFor(dialect: Dialect, column: ColumnDef, keyed: boolean): string {
  return column.hint?.columnType?.[dialect.name] ?? dialect.columnType(column, keyed);
}
