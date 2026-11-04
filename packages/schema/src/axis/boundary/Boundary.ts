import type { Decoder } from './Decoder.js';
import type { Encoder } from './Encoder.js';
import { Boundaries } from './Decoder.js';
import type { Field } from '../../field/Field.js';
import { type Shape } from '../shape/Shape.js';
import { Shapes } from '../shape/Shape.js';
import { SchemaError } from '../../SchemaError.js';
import { Format, type Accepted } from '../../lib/Format.js';
import { isObject } from '../../lib/utils.js';

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
    return this.of(field).readOnly();
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
        typeof declared.rules.in === 'object'
          ? Boundaries.decoders.resolve(declared.rules.in.decode)
          : derived.decode,
      encode:
        rules.out === 'closed'
          ? identityEncoder
          : Boundary.closing(
              field.shape,
              typeof declared.rules.out === 'object'
                ? Boundaries.encoders.resolve(declared.rules.out.encode)
                : derived.encode,
            ),
    });
  }

  /** What a row leaves as: `encode`, then without the keys its shape closes. */
  private static closing(shape: Shape | undefined, encode: Encoder): Encoder {
    const close = Boundary.closedKeysOf(shape);

    return close === identityEncoder ? encode : (value) => close(encode(value));
  }

  /**
   * `writeOnly` on a property of `json(Account)`, at any depth. It sits beside `forShape` and not
   * in it, because the judge encodes through `forShape` and must still see what a write carries.
   */
  private static closedKeysOf(shape: Shape | undefined): Encoder {
    const base = Shapes.of(shape).base;
    if (base?.type === 'array' && base.items) return Boundary.closingEach(Boundary.closedKeysOf(base.items));
    if (base?.type !== 'object' || !base.properties) return identityEncoder;

    const properties = Object.entries(base.properties as Record<string, Shape & { writeOnly?: boolean }>);
    const closed = properties.filter(([, property]) => property.writeOnly).map(([key]) => key);
    const nested = properties
      .filter(([, property]) => !property.writeOnly)
      .map(([key, property]) => [key, Boundary.closedKeysOf(property)] as const)
      .filter(([, close]) => close !== identityEncoder);
    if (closed.length === 0 && nested.length === 0) return identityEncoder;

    return (value) => {
      if (!isObject(value)) return value;
      const row: Record<string, unknown> = { ...value };
      for (const key of closed) delete row[key];
      for (const [key, close] of nested) {
        if (row[key] !== null && row[key] !== undefined) row[key] = close(row[key]);
      }

      return row;
    };
  }

  private static closingEach(close: Encoder): Encoder {
    if (close === identityEncoder) return identityEncoder;

    return (value) =>
      Array.isArray(value) ? value.map((element) => (element === null || element === undefined ? element : close(element))) : value;
  }

  /**
   * `date-time` means a `Date` on both sides, without a word in the entity — and so does a
   * `date-time` inside `json(Address)`, read off the properties the shape already states.
   */
  static forShape(shape: Shape | undefined): Boundary {
    if (Shapes.typeOf(shape) === 'date') {
      return new Boundary(Boundaries.aliases.resolve('isoDate'), {
        decode: Boundaries.decoders.resolve('isoDate'),
        encode: Boundaries.encoders.resolve('isoDate'),
      });
    }

    const base = Shapes.of(shape).base;
    if (base?.type === 'object' && base.properties) return Boundary.within(base.properties as Record<string, Shape>);
    if (base?.type === 'array' && base.items) return Boundary.each(Boundary.forShape(base.items));

    return new Boundary();
  }

  private static within(properties: Record<string, Shape>): Boundary {
    const boundaries = Object.entries(properties)
      .map(([key, shape]) => [key, Boundary.forShape(shape)] as const)
      .filter(([, boundary]) => boundary.decode !== identityDecoder);
    if (boundaries.length === 0) return new Boundary();

    const decode: Decoder = (value) => {
      if (!isObject(value)) return { value };
      const row: Record<string, unknown> = { ...value };
      for (const [key, boundary] of boundaries) {
        if (row[key] === null || row[key] === undefined) continue;
        const verdict = boundary.decode(row[key]);
        if ('message' in verdict) return { ...verdict, path: [key, ...(verdict.path ?? [])] };
        row[key] = verdict.value;
      }

      return { value: row };
    };
    const encode: Encoder = (value) => {
      if (!isObject(value)) return value;
      const row: Record<string, unknown> = { ...value };
      for (const [key, boundary] of boundaries) {
        if (row[key] === null || row[key] === undefined) continue;
        row[key] = boundary.encode(row[key]);
      }

      return row;
    };

    return new Boundary({}, { decode, encode });
  }

  private static each(item: Boundary): Boundary {
    if (item.decode === identityDecoder) return new Boundary();

    const decode: Decoder = (value) => {
      if (!Array.isArray(value)) return { value };
      const items: unknown[] = [];
      for (const [index, element] of value.entries()) {
        if (element === null || element === undefined) {
          items.push(element);
          continue;
        }
        const verdict = item.decode(element);
        if ('message' in verdict) return { ...verdict, path: [String(index), ...(verdict.path ?? [])] };
        items.push(verdict.value);
      }

      return { value: items };
    };
    const encode: Encoder = (value) =>
      Array.isArray(value) ? value.map((element) => (element === null || element === undefined ? element : item.encode(element))) : value;

    return new Boundary({}, { decode, encode });
  }

  /** The dual of `declared`: what `readOnly()` writes back on the field, not a judge. */
  declaring(overrides: BoundaryRules): BoundaryRules {
    const rules: BoundaryRules = { in: overrides.in ?? this.rules.in, out: overrides.out ?? this.rules.out };

    return Object.fromEntries(Object.entries(rules).filter(([, half]) => half !== undefined));
  }

  readOnly(): boolean {
    return this.rules.in === 'closed';
  }

  writeOnly(): boolean {
    return this.rules.out === 'closed';
  }
}

declare module '../../FougereFieldAxes.js' {
  interface FougereFieldAxes {
    readonly boundary?: BoundaryRef;
  }
}
