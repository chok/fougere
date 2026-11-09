/** Shape → CHECK constraints. */
import { sql, type Expression, type SqlBool } from 'kysely';
import type { ColumnDef } from './table/ColumnDef.js';

/** What a column's shape can be checked for, beyond its type. */
export interface ShapeBounds {
  enum?: readonly (string | number)[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
}

/** The CHECK expression for one column, or nothing when its shape bounds nothing. */
export function checkFor(column: ColumnDef): Expression<SqlBool> | undefined {
  const bounds = column.bounds;
  if (!bounds) return undefined;

  const col = sql.ref(column.name);
  const terms: Expression<SqlBool>[] = [];

  if (bounds.enum?.length) {
    terms.push(sql<SqlBool>`${col} in (${sql.join(bounds.enum.map((v) => sql.lit(v)))})`);
  }
  if (bounds.minLength !== undefined) terms.push(sql<SqlBool>`length(${col}) >= ${sql.lit(bounds.minLength)}`);
  if (bounds.maxLength !== undefined) terms.push(sql<SqlBool>`length(${col}) <= ${sql.lit(bounds.maxLength)}`);
  if (bounds.minimum !== undefined) terms.push(sql<SqlBool>`${col} >= ${sql.lit(bounds.minimum)}`);
  if (bounds.maximum !== undefined) terms.push(sql<SqlBool>`${col} <= ${sql.lit(bounds.maximum)}`);
  if (bounds.exclusiveMinimum !== undefined) terms.push(sql<SqlBool>`${col} > ${sql.lit(bounds.exclusiveMinimum)}`);
  if (bounds.exclusiveMaximum !== undefined) terms.push(sql<SqlBool>`${col} < ${sql.lit(bounds.exclusiveMaximum)}`);

  if (terms.length === 0) return undefined;

  const all = terms.reduce((left, right) => sql<SqlBool>`${left} and ${right}`);

  return column.nullable ? sql<SqlBool>`${col} is null or (${all})` : all;
}

/** Read the bounds off a field's base shape — the keywords a database can decide. */
export function boundsOf(shape: Record<string, unknown> | undefined): ShapeBounds | undefined {
  if (!shape) return undefined;

  const bounds: ShapeBounds = {};
  if (Array.isArray(shape.enum) && shape.enum.length > 0) bounds.enum = shape.enum;
  if (typeof shape.const === 'string' || typeof shape.const === 'number') bounds.enum = [shape.const];
  for (const key of ['minLength', 'maxLength', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum'] as const) {
    if (typeof shape[key] === 'number') bounds[key] = shape[key] as number;
  }

  return Object.keys(bounds).length > 0 ? bounds : undefined;
}
