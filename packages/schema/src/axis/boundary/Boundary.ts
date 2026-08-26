import type { Decoder, Encoder } from './Boundaries.js';
import { Boundaries } from './Boundaries.js';
import type { Field } from '../../fields/Field.js';
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

  private constructor(rules: BoundaryRules = {}, codecs?: { decode: Decoder; encode: Encoder }) {
    this.in = rules.in;
    this.out = rules.out;
    this.decode = codecs?.decode ?? identityDecoder;
    this.encode = codecs?.encode ?? identityEncoder;
  }

  static declared(field: Field): Boundary {
    const ref = field.boundary;
    if (ref === undefined) return new Boundary();
    if (typeof ref !== 'string') return new Boundary(ref);

    const alias = Boundaries.alias(ref);
    if (!alias) throw new Error(`Unknown boundary alias: '${ref}'`);
    return new Boundary(alias);
  }

  static of(field: Field): Boundary {
    const declared = Boundary.declared(field);
    const derived = Boundary.forShape(field.shape);
    const rules: BoundaryRules = { in: declared.in ?? derived.in, out: declared.out ?? derived.out };
    return new Boundary(rules, {
      decode: typeof rules.in === 'object' ? Boundaries.decoder(rules.in.decode) : identityDecoder,
      encode: typeof rules.out === 'object' ? Boundaries.encoder(rules.out.encode) : identityEncoder,
    });
  }

  static forShape(shape: Shape | undefined): Boundary {
    const base = Anatomy.of(shape).base;
    if (base?.type === 'string' && base.format === 'date-time') {
      return new Boundary(Boundaries.alias('isoDate')!);
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
