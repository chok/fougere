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
  write: (v) => (v instanceof Date ? v.toISOString() : v),
  read: (v) => (typeof v === 'string' ? new Date(v) : v),
};

const json: ValueCodec = {
  write: (v) => (typeof v === 'string' ? v : JSON.stringify(v)),
  read: (v) => (typeof v === 'string' ? JSON.parse(v) : v),
};

const numeric: ValueCodec = {
  write: (v) => (typeof v === 'bigint' ? fits(v) : v),
  read: (v) => {
    if (typeof v === 'bigint') return fits(v);
    if (typeof v !== 'string') return v;

    return /^-?\d+$/.test(v) ? fits(BigInt(v)) : Number(v);
  },
};

function fits(value: bigint): number {
  if (value >= MIN_SAFE && value <= MAX_SAFE) return Number(value);
  throw new Error(
    `${value} is too large for a JavaScript number. Declare the field as \`text()\` to keep it exact.`,
  );
}

const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

function nullSafe(codec: ValueCodec): ValueCodec {
  const pass = (fn: (v: unknown) => unknown) => (v: unknown) =>
    v === null || v === undefined ? v : fn(v);

  return { write: pass(codec.write), read: pass(codec.read) };
}

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
