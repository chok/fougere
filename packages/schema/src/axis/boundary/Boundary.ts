import type { Decoder } from './Decoder.js';
import type { Encoder } from './Encoder.js';
import { Boundaries } from './Decoder.js';
import type { Field } from '../../field/Field.js';
import { type Shape } from '../shape/Shape.js';
import { Shapes } from '../shape/Shape.js';
import { SchemaError } from '../../SchemaError.js';
import { Format, type Accepted } from '../../lib/Format.js';

const closedOr = <Verb extends 'decode' | 'encode'>(verb: Verb) =>
  Format.either(Format.tokens(['closed']), Format.of().key(verb, Format.text).needs(verb).closed());

const RULES = Format.of().key('in', closedOr('decode')).key('out', closedOr('encode')).closed();

const BOUNDARY = Format.named(
  'axis/boundary',
  Format.either(Format.text.as<'isoDate' | (string & {})>(), RULES),
);

export type BoundaryRules = Accepted<typeof RULES>;

export type BoundaryRef = Accepted<typeof BOUNDARY>;

const identityDecoder: Decoder = (value) => ({ value });

const identityEncoder: Encoder = (value) => value;

export class Boundary {
  static readonly format = BOUNDARY;

  readonly decode: Decoder;
  readonly encode: Encoder;

  private constructor(
    private readonly rules: BoundaryRules = {},
    codecs?: { decode: Decoder; encode: Encoder },
  ) {
    this.decode = codecs?.decode ?? identityDecoder;
    this.encode = codecs?.encode ?? identityEncoder;
  }

  /** An unknown alias stops here. */
  static declared(field: Field): Boundary {
    const ref = field.boundary;
    if (ref === undefined) return new Boundary();
    if (typeof ref !== 'string') return new Boundary(ref);

    const alias = Boundaries.aliases.find(ref);
    if (!alias) throw new SchemaError(`Unknown boundary alias: '${ref}'`);

    return new Boundary(alias);
  }

  /** The server fills it, so a caller never sends it. */
  static admitsAbsence(field: Field): boolean {
    return this.of(field).readOnly;
  }

  static of(field: Field): Boundary {
    const declared = Boundary.declared(field);
    const derived = Boundary.forShape(field.shape);
    const rules: BoundaryRules = {
      in: declared.rules.in ?? derived.rules.in,
      out: declared.rules.out ?? derived.rules.out,
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

  /** `date-time` means a `Date` on both sides, without a word in the entity. */
  static forShape(shape: Shape | undefined): Boundary {
    if (Shapes.typeOf(shape) === 'date') return new Boundary(Boundaries.aliases.resolve('isoDate'));

    return new Boundary();
  }

  /** The dual of `declared`: what `readOnly()` writes back on the field, not a judge. */
  declaring(overrides: BoundaryRules): BoundaryRules {
    return { in: overrides.in ?? this.rules.in, out: overrides.out ?? this.rules.out };
  }

  get readOnly(): boolean {
    return this.rules.in === 'closed';
  }

  get writeOnly(): boolean {
    return this.rules.out === 'closed';
  }
}
