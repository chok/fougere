/**
 * The values a driver accepts, and the values an entity declares.
 *
 * A driver binds numbers, strings, buffers and null — nothing else. An entity declares
 * booleans, dates, lists and objects. Something has to sit between the two, and until
 * now nothing did: `done: bool()` threw at insert ("SQLite3 can only bind numbers,
 * strings, bigints, buffers, and null"), a `date()` could only be written as the ISO
 * string its own type forbids, and both came back as whatever the column held.
 *
 * The pair below is derived from the column's shape alone — no new declaration, no axis
 * to read. It lives in the storage adapter because that is where the driver's limits are
 * known; the entity keeps saying `boolean` and `Date`.
 *
 * Drivers differ in how much they already do (Postgres hands back real booleans and
 * Dates, SQLite hands back 0/1 and text), so every read guards on what it actually got
 * instead of assuming.
 */
import type { ColumnShape } from './table.js';

export interface ValueCodec {
  /** Entity value → what the driver can bind. */
  write(value: unknown): unknown;
  /** What the driver returned → the value the entity declares. */
  read(value: unknown): unknown;
}

const identity: ValueCodec = { write: (v) => v, read: (v) => v };

const boolean: ValueCodec = {
  write: (v) => (v ? 1 : 0),
  read: (v) => Boolean(v),
};

const dateTime: ValueCodec = {
  // A handler may hand over a Date (what the field declares) or an ISO string (what the
  // pre-fix workarounds passed) — both must keep working.
  write: (v) => (v instanceof Date ? v.toISOString() : v),
  read: (v) => (typeof v === 'string' ? new Date(v) : v),
};

const json: ValueCodec = {
  write: (v) => (typeof v === 'string' ? v : JSON.stringify(v)),
  // Already parsed by the driver (Postgres jsonb) → leave it. Text → parse. A column
  // holding invalid JSON is a corrupt row, not a value to guess at: let it throw.
  read: (v) => (typeof v === 'string' ? JSON.parse(v) : v),
};

/** Absent stays absent, null stays null — a codec never invents a value. */
function nullSafe(codec: ValueCodec): ValueCodec {
  const pass = (fn: (v: unknown) => unknown) => (v: unknown) =>
    v === null || v === undefined ? v : fn(v);
  return { write: pass(codec.write), read: pass(codec.read) };
}

/** The pair a column's shape calls for — identity when the driver already accepts it. */
export function codecFor(shape?: ColumnShape): ValueCodec {
  switch (shape?.type) {
    case 'boolean':
      return nullSafe(boolean);
    case 'string':
      return shape.format === 'date-time' ? nullSafe(dateTime) : identity;
    case 'array':
    case 'object':
      return nullSafe(json);
    default:
      return identity;
  }
}

/** Field name → codec, for every column that needs one. Identity columns are omitted. */
export function codecsOf(columns: { field: string; shape?: ColumnShape }[]): Map<string, ValueCodec> {
  const codecs = new Map<string, ValueCodec>();
  for (const column of columns) {
    const codec = codecFor(column.shape);
    if (codec !== identity) codecs.set(column.field, codec);
  }
  return codecs;
}
