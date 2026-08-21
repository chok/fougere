import type { BoundaryRules } from './Boundary.js';

export type Decoder = (value: unknown) => { value: unknown } | { error: string };
export type Encoder = (value: unknown) => unknown;

export class Boundaries {
  private static readonly decoders = new Map<string, Decoder>();
  private static readonly encoders = new Map<string, Encoder>();
  private static readonly aliases = new Map<string, BoundaryRules>();

  static registerDecoder(name: string, fn: Decoder): void { this.decoders.set(name, fn); }
  static registerEncoder(name: string, fn: Encoder): void { this.encoders.set(name, fn); }

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
