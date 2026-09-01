/**
 * Shape → CHECK constraints.
 *
 * `oneOf`, `min`, `max` were declared on the field and read by the façade alone: a
 * handler writing through the storage put `status: 'brouillon'` in a column that declares
 * two values, and nothing said a word. The rule was in the schema; no one held it on
 * that path.
 *
 * So the storage learns what the shape already says. `validate` judges what a client
 * proposes; this holds what anyone writes — including us.
 *
 * Only the keywords a database can decide alone. `pattern` and `format` are left to
 * the façade: regex dialects diverge (POSIX here, PCRE there, nothing in SQLite
 * without an extension), and a constraint that means something different per engine
 * is worse than none.
 *
 * Every value is inlined with `sql.lit`, not bound: SQLite answers `parameters
 * prohibited in CHECK constraints`, and a constraint is part of the schema rather
 * than of a query. The values are the author's own literals — `oneOf('draft', …)`,
 * `max: 160` — never anything a request carried, and Kysely escapes them.
 */
import { sql, type Expression, type SqlBool } from 'kysely';
import type { ColumnDef } from './table.js';

/** What a column's shape can be checked for, beyond its type. */
export interface ShapeBounds {
  enum?: readonly (string | number)[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}

/**
 * The CHECK expression for one column, or nothing when its shape bounds nothing.
 *
 * A nullable column passes when it holds `null`: `NOT NULL` is the axis that decides
 * presence, and stacking the two would make `optional()` unwritable.
 */
export function checkFor(column: ColumnDef): Expression<SqlBool> | undefined {
  const bounds = column.bounds;
  if (!bounds) return undefined;

  const col = sql.ref(column.name);
  const terms: Expression<SqlBool>[] = [];

  if (bounds.enum?.length) {
    terms.push(sql<SqlBool>`${col} in (${sql.join(bounds.enum.map((v) => sql.lit(v)))})`);
  }
  // Length, not value: a text bound is about the string, and `maxLength` is already
  // spent on the column type where the dialect uses it (varchar(n)) — stating it
  // again costs nothing and holds where the type does not (text columns).
  if (bounds.minLength !== undefined) terms.push(sql<SqlBool>`length(${col}) >= ${sql.lit(bounds.minLength)}`);
  if (bounds.maxLength !== undefined) terms.push(sql<SqlBool>`length(${col}) <= ${sql.lit(bounds.maxLength)}`);
  if (bounds.minimum !== undefined) terms.push(sql<SqlBool>`${col} >= ${sql.lit(bounds.minimum)}`);
  if (bounds.maximum !== undefined) terms.push(sql<SqlBool>`${col} <= ${sql.lit(bounds.maximum)}`);

  if (terms.length === 0) return undefined;

  const all = terms.reduce((left, right) => sql<SqlBool>`${left} and ${right}`);

  return column.nullable ? sql<SqlBool>`${col} is null or (${all})` : all;
}

/** Read the bounds off a field's base shape — the keywords a database can decide. */
export function boundsOf(shape: Record<string, unknown> | undefined): ShapeBounds | undefined {
  if (!shape) return undefined;

  const bounds: ShapeBounds = {};
  if (Array.isArray(shape.enum) && shape.enum.length > 0) bounds.enum = shape.enum as string[];
  for (const key of ['minLength', 'maxLength', 'minimum', 'maximum'] as const) {
    if (typeof shape[key] === 'number') bounds[key] = shape[key] as number;
  }

  return Object.keys(bounds).length > 0 ? bounds : undefined;
}
