import type { BoundaryRules } from './Boundary.js';
// ─── The codec registry — an open vocabulary, like Formats and Generators ────
// A boundary names its conversion; here the name is bound to a function. Open by
// construction: a frond declares `{ decode: 'celsius' }` and each runtime resolves it
// locally, so the rule crosses a process, or a language.

/** Inbound: a supplied wire value → domain value. May fail (transformOrFail-style). */
export type Decoder = (value: unknown) => { value: unknown } | { error: string };
/** Outbound: a domain value → wire value. Total — a valid domain value always encodes. */
export type Encoder = (value: unknown) => unknown;


// ─── Registries (open, extensible — same spirit as FougereHints) ──

export class Boundaries {
  private static readonly decoders = new Map<string, Decoder>();
  private static readonly encoders = new Map<string, Encoder>();
  private static readonly aliases = new Map<string, BoundaryRules>();

  static registerDecoder(name: string, fn: Decoder): void { this.decoders.set(name, fn); }
  static registerEncoder(name: string, fn: Encoder): void { this.encoders.set(name, fn); }

  /** Name a pair of directional rules, so a field declares `boundary: 'moneyCents'`. */
  static registerAlias(name: string, boundary: BoundaryRules): void { this.aliases.set(name, boundary); }

  static alias(name: string): BoundaryRules | undefined { return this.aliases.get(name); }

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

