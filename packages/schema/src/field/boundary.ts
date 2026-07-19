import type { AnyField } from './field.js';
import { anatomy, type Shape } from './shape.js';

/**
 * Axis 4 · boundary — HOW AND IN WHICH DIRECTION a value crosses wire↔domain.
 *
 * The normal form is indexed by DIRECTION: `in` runs inbound (parse a request /
 * a DB row → domain value), `out` runs outbound (domain value → response /
 * storage). Each direction carries one of the two facets of the same frontier:
 * a conversion (`{ decode }` / `{ encode }`, a NAMED rule) or the permission
 * token `'closed'` — read-only closes `in` (never accepted from a client),
 * write-only closes `out` (never emitted, e.g. a password). A key absent →
 * that direction is open, identity conversion. Declarative and named — never
 * an opaque closure, so adapters stay able to read what a field does.
 *
 * Two directional registries (decoders, encoders) are the pure base; an alias is
 * just a named pair. A field rarely declares a boundary: the default is DERIVED
 * from `shape` (convention over config). A declared boundary overrides that
 * default PER DIRECTION — closing `out` on a date field leaves the derived
 * isoDate decode on `in` intact.
 */

/** Inbound: a supplied wire value → domain value. May fail (transformOrFail-style). */
export type Decoder = (value: unknown) => { value: unknown } | { error: string };
/** Outbound: a domain value → wire value. Total — a valid domain value always encodes. */
export type Encoder = (value: unknown) => unknown;

/** The normal form, indexed by direction. Either direction absent → open, identity. */
export interface Boundary {
  in?: 'closed' | { decode: string };
  out?: 'closed' | { encode: string };
}

/**
 * What a field may carry on its `boundary` slot:
 * - a string — an ALIAS, resolved to a {@link Boundary} in the alias registry
 * - a {@link Boundary} — directional rules directly (allows asymmetry)
 *
 * The bare string literals are the built-in aliases; `(string & {})` keeps
 * autocomplete on them while leaving the set open to `registerBoundaryAlias`.
 */
export type BoundaryRef = 'isoDate' | (string & {}) | Boundary;

// ─── Registries (open, extensible — same spirit as FougereHints) ──

const decoders = new Map<string, Decoder>();
const encoders = new Map<string, Encoder>();
const aliases = new Map<string, Boundary>();

export function registerDecoder(name: string, fn: Decoder): void {
  decoders.set(name, fn);
}
export function registerEncoder(name: string, fn: Encoder): void {
  encoders.set(name, fn);
}
/** Register a named boundary — the alias a field can reference. */
export function registerBoundaryAlias(name: string, boundary: Boundary): void {
  aliases.set(name, boundary);
}

// ─── Built-ins ───────────────────────────────────────

const identityDecoder: Decoder = (value) => ({ value });
const identityEncoder: Encoder = (value) => value;

// `isoDate`: the only non-identity built-in. Inbound accepts a Date or an ISO-ish
// string and yields a Date; outbound yields an ISO string. Validity is already
// guaranteed by `shape` (the date predicate) before decode runs.
registerDecoder('isoDate', (value) => {
  if (value instanceof Date) return { value };
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? { error: 'Invalid date' } : { value: d };
  }
  return { error: 'Expected a date' };
});
registerEncoder('isoDate', (value) =>
  value instanceof Date ? value.toISOString() : value,
);
registerBoundaryAlias('isoDate', { in: { decode: 'isoDate' }, out: { encode: 'isoDate' } });

/** Default boundary derived from a field's shape. A date-time string → isoDate, else identity. */
function defaultBoundaryForShape(shape: Shape | undefined): Boundary {
  const base = anatomy(shape).base;
  if (base && base.type === 'string' && base.format === 'date-time') return aliases.get('isoDate')!;
  return {};
}

// ─── Resolution ──────────────────────────────────────

/** The field's DECLARED boundary in normal form (alias resolved) — no derived default. */
export function declaredBoundary(field: AnyField): Boundary {
  const ref = field.boundary;
  if (ref === undefined) return {};
  if (typeof ref === 'string') {
    const alias = aliases.get(ref);
    if (!alias) throw new Error(`Unknown boundary alias: '${ref}'`);
    return alias;
  }
  return ref;
}

/**
 * The field's EFFECTIVE boundary: declared rules win per direction, the
 * shape-derived default fills the rest. This is the reader every consumer of
 * the axis goes through — `boundaryOf(f).in === 'closed'` is the read-only
 * test, `.out === 'closed'` the write-only one.
 */
export function boundaryOf(field: AnyField): Boundary {
  const declared = declaredBoundary(field);
  const derived = defaultBoundaryForShape(field.shape);
  return { in: declared.in ?? derived.in, out: declared.out ?? derived.out };
}

/**
 * A field's effective conversion functions. The permission facet is not read
 * here: a `'closed'` direction converts as identity — its rejection/omission
 * happens in the readers (validation, encode) BEFORE any conversion.
 */
export function resolveBoundary(field: AnyField): { decode: Decoder; encode: Encoder } {
  const boundary = boundaryOf(field);
  const decode = typeof boundary.in === 'object' ? decoders.get(boundary.in.decode) : undefined;
  const encode = typeof boundary.out === 'object' ? encoders.get(boundary.out.encode) : undefined;
  return { decode: decode ?? identityDecoder, encode: encode ?? identityEncoder };
}
