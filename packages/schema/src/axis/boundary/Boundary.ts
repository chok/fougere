import type { Decoder, Encoder } from './Boundaries.js';
import { Boundaries } from './Boundaries.js';
import type { Field } from '../../Field.js';
import { Anatomy, type Shape } from '../shape/Shape.js';

/**
 * Axis 4 · boundary — HOW and IN WHICH DIRECTION a value crosses the CLIENT frontier.
 *
 * ⚠️ The client frontier ONLY: `in` parses a request, `out` renders a response. No storage
 * adapter reads it, so the domain↔column conversion is a second frontier, unnamed today.
 *
 * Each direction carries one of two facets: a NAMED conversion (`{ decode }`/`{ encode }`)
 * or the permission token `'closed'`. Absent → open, identity. Named and never a closure,
 * so an adapter can read what a field does. The default is derived from `shape`; a
 * declared boundary overrides it per direction.
 *
 * The codecs themselves live in {@link Boundaries}: naming a conversion and BINDING that
 * name to a function are two things, and only the second is a registry.
 */

/** The normal form a field DECLARES, indexed by direction. Either absent → open, identity. */
export interface BoundaryRules {
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
export type BoundaryRef = 'isoDate' | (string & {}) | BoundaryRules;

/**
 * A field's boundary, resolved: the rules it declares, each direction filled in by the
 * default its shape implies. One accessor — `Boundary.of(field)` — answers the permission
 * question and carries the conversion, where three free functions used to.
 *
 * ```ts
 * Boundary.of(text()).readOnly              // → false
 * Boundary.of(date()).decode('2026-08-16')  // → { value: Date }
 * Boundary.of(text({ boundary: { in: 'closed' } })).readOnly   // → true
 * ```
 */
const identityDecoder: Decoder = (value) => ({ value });
const identityEncoder: Encoder = (value) => value;

export class Boundary implements BoundaryRules {
  readonly in?: BoundaryRules['in'];
  readonly out?: BoundaryRules['out'];
  /** Bound, so `const { decode, encode } = Boundary.of(f)` keeps working. */
  readonly decode: Decoder;
  readonly encode: Encoder;

  // `in` is a reserved word in a parameter property, so the slots are assigned here.
  private constructor(rules: BoundaryRules = {}, codecs?: { decode: Decoder; encode: Encoder }) {
    this.in = rules.in;
    this.out = rules.out;
    this.decode = codecs?.decode ?? identityDecoder;
    this.encode = codecs?.encode ?? identityEncoder;
  }

  /** What the field STATES, alias resolved — no shape-derived default. */
  static declared(field: Field): Boundary {
    const ref = field.boundary;
    if (ref === undefined) return new Boundary();
    if (typeof ref !== 'string') return new Boundary(ref);

    const alias = Boundaries.alias(ref);
    if (!alias) throw new Error(`Unknown boundary alias: '${ref}'`);
    return new Boundary(alias);
  }

  /**
   * What the field EFFECTIVELY does — declared rules win per direction, and the codecs are
   * resolved HERE rather than at conversion time. That is what makes the two spellings of
   * the axis fail alike: an unregistered `{ decode: 'celsius' }` throws where an unknown
   * alias throws, instead of converting as identity while the card says it converted.
   */
  static of(field: Field): Boundary {
    const declared = Boundary.declared(field);
    const derived = Boundary.forShape(field.shape);
    const rules: BoundaryRules = { in: declared.in ?? derived.in, out: declared.out ?? derived.out };
    return new Boundary(rules, {
      decode: typeof rules.in === 'object' ? Boundaries.decoder(rules.in.decode) : identityDecoder,
      encode: typeof rules.out === 'object' ? Boundaries.encoder(rules.out.encode) : identityEncoder,
    });
  }

  /** The default a shape implies. A date-time string converts through isoDate, else identity. */
  static forShape(shape: Shape | undefined): Boundary {
    const base = Anatomy.of(shape).base;
    if (base?.type === 'string' && base.format === 'date-time') {
      return new Boundary(Boundaries.alias('isoDate')!);
    }
    return new Boundary();
  }

  /** The same rules with one direction replaced — how `readOnly()`/`writeOnly()` are built. */
  with(overrides: BoundaryRules): Boundary {
    return new Boundary({ in: overrides.in ?? this.in, out: overrides.out ?? this.out });
  }

  /** The client may not send it. A closed direction converts as identity. */
  get readOnly(): boolean {
    return this.in === 'closed';
  }

  /** The client never sees it — a password hash on the way out. */
  get writeOnly(): boolean {
    return this.out === 'closed';
  }

}

