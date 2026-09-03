import type { BoundaryRules } from './Boundary.js';

export type Decoder = (value: unknown) => { value: unknown } | { error: string };
export type Encoder = (value: unknown) => unknown;

export class Boundaries {
  private static readonly decoders = new Map<string, Decoder>();
  private static readonly encoders = new Map<string, Encoder>();
  private static readonly aliases = new Map<string, BoundaryRules>();

  /**
   * So an app decides what a wire value becomes on the way in, without touching this package.
   * FR : pour qu'une application décide ce que devient une valeur à l'entrée.
   * `Boundaries.registerDecoder('isoDate', …)` → `'2026-01-01'` reaches a handler as a `Date`
   */
  static registerDecoder(name: string, fn: Decoder): void { this.decoders.set(name, fn); }
  /**
   * So the way out is declared beside the way in, and a codec is never half a pair.
   * FR : pour que la sortie se déclare à côté de l'entrée, jamais seule.
   * `Boundaries.registerEncoder('isoDate', …)` → a `Date` leaves as `'2026-01-01T00:00:00.000Z'`
   */
  static registerEncoder(name: string, fn: Encoder): void { this.encoders.set(name, fn); }

  /**
   * So a field names one word instead of spelling a decode and an encode.
   * FR : pour qu'un champ nomme un mot au lieu d'un decode et d'un encode.
   * `boundary: 'isoDate'` → `{ in: { decode: 'isoDate' }, out: { encode: 'isoDate' } }`
   */
  static registerAlias(name: string, boundary: BoundaryRules): void { this.aliases.set(name, boundary); }

  /**
   * So the absence is answered here, and whoever asked names the alias in its own refusal.
   * FR : pour que l'absence soit répondue ici, et nommée par qui a demandé.
   * `Boundaries.alias('nope')` → `undefined`
   */
  static alias(name: string): BoundaryRules | undefined { return this.aliases.get(name); }

  /**
   * So a decoder nobody registered stops the boot rather than silently passing values through.
   * FR : pour qu'un décodeur non enregistré arrête le démarrage.
   * `Boundaries.decoder('nope')`
   * → throws `Unknown boundary decoder: 'nope'. Register it with Boundaries.registerDecoder('nope', …).`
   */
  static decoder(name: string): Decoder { return this.named(this.decoders, name, 'decoder'); }
  /**
   * So the outbound side refuses exactly like the inbound one, in the same words.
   * FR : pour que la sortie refuse comme l'entrée, dans les mêmes mots.
   * `Boundaries.encoder('nope')` → throws, naming `Boundaries.registerEncoder`
   */
  static encoder(name: string): Encoder { return this.named(this.encoders, name, 'encoder'); }

  /**
   * So both registries refuse in one voice, naming the register call that would repair it.
   * FR : pour que les deux registres refusent d'une voix, en nommant le remède.
   * `named(decoders, 'nope', 'decoder')` → the message says `Boundaries.registerDecoder`
   */
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
