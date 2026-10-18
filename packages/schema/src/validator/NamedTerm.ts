import { Lifecycle } from '../axis/lifecycle/Lifecycle.js';
import { Generators } from '../axis/lifecycle/Generators.js';
import { Shapes } from '../axis/shape/Shape.js';
import { Boundaries } from '../axis/boundary/Decoder.js';
import type { BoundaryRules } from '../axis/boundary/Boundary.js';
import type { Field } from '../field/Field.js';
import type { SchemaView } from '../SchemaView.js';
import { FieldValueValidator } from './FieldValueValidator.js';

type Kind = 'format' | 'generator' | 'boundary' | 'decoder' | 'encoder';

/** What answers each kind of name, besides what a format engine knows natively. */
const REGISTRIES = {
  generator: Generators,
  boundary: Boundaries.aliases,
  decoder: Boundaries.decoders,
  encoder: Boundaries.encoders,
} as const;

/**
 * A term a field names by its name, which a registry answers — `format: 'slug'`, `generate: 'ulid'`,
 * `boundary: 'moneyCents'` and the codecs its rules name. `role` names a class, so it has none.
 */
export class NamedTerm {
  constructor(
    readonly field: string,
    readonly kind: Kind,
    readonly name: string,
  ) {}

  /** Every term the fields of a schema name. */
  static in(schema: SchemaView): NamedTerm[] {
    return Object.entries(schema.getFields()).flatMap(([key, field]) =>
      NamedTerm.of(field).map(([kind, name]) => new NamedTerm(key, kind, name)));
  }

  private static of(field: Field): [Kind, string][] {
    const base = Shapes.of(field.shape).base;
    const format = base?.type === 'string' ? base.format : undefined;
    const generator = Lifecycle.of(field).generator();
    const boundary = field.boundary;
    const rules = typeof boundary === 'string' ? Boundaries.aliases.find(boundary) : boundary;

    return [
      ...(format === undefined ? [] : [['format', format] as [Kind, string]]),
      ...(generator === undefined ? [] : [['generator', generator] as [Kind, string]]),
      ...(typeof boundary === 'string' ? [['boundary', boundary] as [Kind, string]] : []),
      ...NamedTerm.codecsOf(rules),
    ];
  }

  private static codecsOf(rules: BoundaryRules | undefined): [Kind, string][] {
    return [
      ...(typeof rules?.in === 'object' ? [['decoder', rules.in.decode] as [Kind, string]] : []),
      ...(typeof rules?.out === 'object' ? [['encoder', rules.out.encode] as [Kind, string]] : []),
    ];
  }

  /** Whether this process answers it — a format natively or by `StringFormats`, the rest by its registry. */
  answered(): boolean {
    return this.kind === 'format'
      ? FieldValueValidator.answers(this.name)
      : REGISTRIES[this.kind].find(this.name) !== undefined;
  }
}
