/** The values a driver accepts, and the values an entity declares. */
import type { ShapeType } from '@fougere/schema';

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

/**
 * A driver may answer a number as a BigInt — Postgres does it for `count(*)` and for `bigint`
 * columns, DuckDB for every count.
 */
const numeric: ValueCodec = {
  write: (v) => (typeof v === 'bigint' ? fits(v) : v),
  read: (v) => (typeof v === 'bigint' ? fits(v) : v),
};

function fits(value: bigint): number {
  if (value >= MIN_SAFE && value <= MAX_SAFE) return Number(value);
  throw new Error(
    `${value} does not fit a JavaScript number — declare the field as \`text()\` to keep it whole.`,
  );
}

const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/** Absent stays absent, null stays null — a codec never invents a value. */
function nullSafe(codec: ValueCodec): ValueCodec {
  const pass = (fn: (v: unknown) => unknown) => (v: unknown) =>
    v === null || v === undefined ? v : fn(v);
  return { write: pass(codec.write), read: pass(codec.read) };
}

/**
 * The pair a column's type calls for — identity where the driver already accepts the value.
 * FR : la paire que le type de la colonne appelle — identité quand le driver accepte déjà.
 * `codecFor('date').write(new Date(0))` → `'1970-01-01T00:00:00.000Z'`
 */
const CODEC_BY_TYPE: Record<ShapeType, ValueCodec> = {
  boolean: nullSafe(boolean),
  integer: nullSafe(numeric),
  number: nullSafe(numeric),
  date: nullSafe(dateTime),
  object: nullSafe(json),
  array: nullSafe(json),
  text: identity,
  choice: identity,
};

export function codecFor(type?: ShapeType): ValueCodec {
  return type ? CODEC_BY_TYPE[type] : identity;
}

/** Field name → codec, for every column that needs one. Identity columns are omitted. */
export function codecsOf(columns: { field: string; type?: ShapeType }[]): Map<string, ValueCodec> {
  const codecs = new Map<string, ValueCodec>();
  for (const column of columns) {
    const codec = codecFor(column.type);
    if (codec !== identity) codecs.set(column.field, codec);
  }
  return codecs;
}
