import type { Field } from './field.js';
import { Anatomy, type Shape } from './shape.js';

/**
 * Axis 4 · boundary — HOW AND IN WHICH DIRECTION a value crosses the CLIENT frontier.
 *
 * ⚠️ SCOPE — this axis covers the client frontier ONLY. A direction is meaningless
 * unless stated relative to a centre, and this one is relative to the domain facing a
 * client: `in` parses a request, `out` renders a response. It does NOT cover storage —
 * no storage adapter reads it, which is exactly why `bool`, `list`, `json` and a judged
 * `date` cannot be written today (they reach the driver unconverted). The domain↔column
 * conversion belongs to the storage adapter, and naming that second frontier is an open
 * design question — see the axes study.
 *
 * The normal form is indexed by DIRECTION. Each direction carries one of the two facets
 * of the same frontier:
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

export class Boundaries {
  private static readonly decoders = new Map<string, Decoder>();
  private static readonly encoders = new Map<string, Encoder>();
  private static readonly aliases = new Map<string, Boundary>();

  static registerDecoder(name: string, fn: Decoder): void { this.decoders.set(name, fn); }
  static registerEncoder(name: string, fn: Encoder): void { this.encoders.set(name, fn); }

  /** Name a pair of directional rules, so a field declares `boundary: 'moneyCents'`. */
  static registerAlias(name: string, boundary: Boundary): void { this.aliases.set(name, boundary); }

  static alias(name: string): Boundary | undefined { return this.aliases.get(name); }

  static decoder(name: string): Decoder { return this.named(this.decoders, name, 'decoder'); }
  static encoder(name: string): Encoder { return this.named(this.encoders, name, 'encoder'); }

  private static named<T>(registry: Map<string, T>, name: string, kind: string): T {
    const fn = registry.get(name);
    if (!fn) {
      throw new Error(
        `Unknown boundary ${kind}: '${name}'. Register it with ` +
          `Boundaries.register${kind[0].toUpperCase()}${kind.slice(1)}('${name}', …).`,
      );
    }
    return fn;
  }
}

const identityDecoder: Decoder = (value) => ({ value });
const identityEncoder: Encoder = (value) => value;

// `isoDate`: the only non-identity built-in. Inbound accepts a Date or an ISO-ish
// string and yields a Date; outbound yields an ISO string. Validity is already
// guaranteed by `shape` (the date predicate) before decode runs.
Boundaries.registerDecoder('isoDate', (value) => {
  if (value instanceof Date) return { value };
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? { error: 'Invalid date' } : { value: d };
  }
  return { error: 'Expected a date' };
});
Boundaries.registerEncoder('isoDate', (value) =>
  value instanceof Date ? value.toISOString() : value,
);
Boundaries.registerAlias('isoDate', { in: { decode: 'isoDate' }, out: { encode: 'isoDate' } });

/** Default boundary derived from a field's shape. A date-time string → isoDate, else identity. */
function defaultBoundaryForShape(shape: Shape | undefined): Boundary {
  const base = Anatomy.of(shape).base;
  if (base && base.type === 'string' && base.format === 'date-time') return Boundaries.alias('isoDate')!;
  return {};
}

// ─── Resolution ──────────────────────────────────────

/** The field's DECLARED boundary in normal form (alias resolved) — no derived default. */
export function declaredBoundary(field: Field): Boundary {
  const ref = field.boundary;
  if (ref === undefined) return {};
  if (typeof ref === 'string') {
    const alias = Boundaries.alias(ref);
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
export function boundaryOf(field: Field): Boundary {
  const declared = declaredBoundary(field);
  const derived = defaultBoundaryForShape(field.shape);
  return { in: declared.in ?? derived.in, out: declared.out ?? derived.out };
}

/**
 * A field's effective conversion functions. A closed direction converts as identity — the
 * permission facet is judged by the façade, not here.
 */
export function resolveBoundary(field: Field): { decode: Decoder; encode: Encoder } {
  const boundary = boundaryOf(field);
  return {
    decode: typeof boundary.in === 'object' ? Boundaries.decoder(boundary.in.decode) : identityDecoder,
    encode: typeof boundary.out === 'object' ? Boundaries.encoder(boundary.out.encode) : identityEncoder,
  };
}

