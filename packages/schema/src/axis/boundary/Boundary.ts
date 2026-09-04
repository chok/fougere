import type { Decoder, Encoder } from './Boundaries.js';
import { Boundaries } from './Boundaries.js';
import type { Field } from '../../field/Field.js';
import { Shapes, type Shape } from '../shape/Shape.js';

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

  /** An unknown alias stops here. */
  static declared(field: Field): Boundary {
    const ref = field.boundary;
    if (ref === undefined) return new Boundary();
    if (typeof ref !== 'string') return new Boundary(ref);

    const alias = Boundaries.aliases.find(ref);
    if (!alias) throw new Error(`Unknown boundary alias: '${ref}'`);
    return new Boundary(alias);
  }

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

  /** `date-time` means a `Date` on both sides, without a word in the entity. */
  static forShape(shape: Shape | undefined): Boundary {
    const base = Shapes.of(shape).base;
    if (base?.type === 'string' && base.format === 'date-time') {
      return new Boundary(Boundaries.aliases.find('isoDate')!);
    }
    return new Boundary();
  }

  with(overrides: BoundaryRules): Boundary {
    return new Boundary({ in: overrides.in ?? this.in, out: overrides.out ?? this.out });
  }

  get readOnly(): boolean {
    return this.in === 'closed';
  }

  get writeOnly(): boolean {
    return this.out === 'closed';
  }
}
