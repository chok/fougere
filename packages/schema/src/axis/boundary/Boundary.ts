import type { Decoder, Encoder } from './Boundaries.js';
import { Boundaries } from './Boundaries.js';
import type { Field } from '../../field/Field.js';
import { Anatomy, type Shape } from '../shape/Shape.js';

export interface BoundaryRules {
  in?: 'closed' | { decode: string };
  out?: 'closed' | { encode: string };
}

export type BoundaryRef = 'isoDate' | (string & {}) | BoundaryRules;

const identityDecoder: Decoder = (value) => ({ value });
const identityEncoder: Encoder = (value) => value;

export class Boundary implements BoundaryRules {
  readonly in?: BoundaryRules['in'];
  readonly out?: BoundaryRules['out'];
  readonly decode: Decoder;
  readonly encode: Encoder;

  private constructor(
    rules: BoundaryRules = {},
    codecs?: { decode: Decoder; encode: Encoder },
  ) {
    this.in = rules.in;
    this.out = rules.out;
    this.decode = codecs?.decode ?? identityDecoder;
    this.encode = codecs?.encode ?? identityEncoder;
  }

  /**
   * So an alias and a written pair arrive as the same value, and an unknown alias stops here.
   * FR : pour qu'un alias et une paire écrite soient la même valeur.
   * `boundary: 'nope'` → throws `Unknown boundary alias: 'nope'`
   */
  static declared(field: Field): Boundary {
    const ref = field.boundary;
    if (ref === undefined) return new Boundary();
    if (typeof ref !== 'string') return new Boundary(ref);

    const alias = Boundaries.aliases.find(ref);
    if (!alias) throw new Error(`Unknown boundary alias: '${ref}'`);
    return new Boundary(alias);
  }

  /**
   * So a field gets the codecs its shape implies without ever declaring them.
   * FR : pour qu'un champ reçoive les codecs que sa forme implique.
   */
  static of(field: Field): Boundary {
    const declared = Boundary.declared(field);
    const derived = Boundary.forShape(field.shape);
    const rules: BoundaryRules = {
      in: declared.in ?? derived.in,
      out: declared.out ?? derived.out,
    };
    return new Boundary(rules, {
      decode:
        typeof rules.in === 'object'
          ? Boundaries.decoders.resolve(rules.in.decode)
          : identityDecoder,
      encode:
        typeof rules.out === 'object'
          ? Boundaries.encoders.resolve(rules.out.encode)
          : identityEncoder,
    });
  }

  /**
   * So `date-time` means a `Date` on both sides everywhere, without a word in the entity.
   * FR : pour que `date-time` veuille dire une `Date` des deux côtés, partout.
   * `{ type: 'string', format: 'date-time' }` → the `isoDate` boundary
   */
  static forShape(shape: Shape | undefined): Boundary {
    const base = Anatomy.of(shape).base;
    if (base?.type === 'string' && base.format === 'date-time') {
      return new Boundary(Boundaries.aliases.find('isoDate')!);
    }
    return new Boundary();
  }

  /**
   * So one side is changed without restating the other.
   * FR : pour qu'on change un côté sans redire l'autre.
   * `Boundary.of(f).with({ out: 'closed' })` → the way in is kept, the way out is closed
   */
  with(overrides: BoundaryRules): Boundary {
    return new Boundary({ in: overrides.in ?? this.in, out: overrides.out ?? this.out });
  }

  /**
   * So the judge asks a question instead of comparing a value to a token.
   * FR : pour que le juge pose une question au lieu de comparer à un jeton.
   * `boundary: { in: 'closed' }` → `readOnly` is `true`, and a client writing it is refused
   */
  get readOnly(): boolean {
    return this.in === 'closed';
  }

  /**
   * So the dual is asked the same way, and a secret never leaves in a response.
   * FR : pour que le dual se demande pareil, et qu'un secret ne reparte pas.
   * `boundary: { out: 'closed' }` → `writeOnly` is `true`
   */
  get writeOnly(): boolean {
    return this.out === 'closed';
  }
}
