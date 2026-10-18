import { Lifecycle } from '../axis/lifecycle/Lifecycle.js';
import { Generators } from '../axis/lifecycle/Generators.js';
import { Shapes } from '../axis/shape/Shape.js';
import type { SchemaView } from '../SchemaView.js';
import { FieldValueValidator } from './FieldValueValidator.js';

/** A term a field names by its name — `format: 'slug'`, `generate: 'ulid'` — which a registry answers. */
export class NamedTerm {
  constructor(
    readonly field: string,
    readonly kind: 'format' | 'generator',
    readonly name: string,
  ) {}

  /** Every term the fields of a schema name. */
  static in(schema: SchemaView): NamedTerm[] {
    return Object.entries(schema.getFields()).flatMap(([key, field]) => {
      const base = Shapes.of(field.shape).base;
      const format = base?.type === 'string' ? base.format : undefined;
      const generator = Lifecycle.of(field).generator();

      return [
        ...(format === undefined ? [] : [new NamedTerm(key, 'format', format)]),
        ...(generator === undefined ? [] : [new NamedTerm(key, 'generator', generator)]),
      ];
    });
  }

  /** Whether this process answers it — a format natively or by `StringFormats`, a generator by `Generators`. */
  answered(): boolean {
    return this.kind === 'format' ? FieldValueValidator.answers(this.name) : Generators.find(this.name) !== undefined;
  }
}
