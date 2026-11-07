import { Axes } from '../../axis/Axes.js';
import { Shapes } from '../../axis/shape/Shape.js';
import { CardForms } from './CardForms.js';
import { type Resolver } from '../../axis/Resolver.js';
import { isObject } from '../../lib/utils.js';
import { Field } from '../../field/Field.js';
import { type Fields } from '../../field/Fields.js';
import { SchemaConstraints } from '../../SchemaConstraints.js';
import { InputValidator } from '../../validator/InputValidator.js';
import { Schema } from '../../Schema.js';
import { type SchemaConstructor } from '../../SchemaConstructor.js';
import type { SchemaView } from '../../SchemaView.js';
import type { Values } from '../../field/Values.js';
import { admitAxis, admitPatterns, refuse } from './admission.js';
import type { DerivedFrom } from './DerivedFrom.js';
import type { FieldDescriptor } from './FieldDescriptor.js';
import type { FieldExtension } from './FieldExtension.js';
import type { SchemaDescriptor } from './SchemaDescriptor.js';
import { compare, type Diff } from './Diff.js';
import { type DiffOptions } from './DiffOptions.js';
import { SchemaError } from '../../SchemaError.js';
import type { ConstraintKind } from '../../SchemaConstraints.js';
import { ENVELOPE } from './Envelope.js';

type FieldsOf<T> = { [K in keyof T]-?: Field<T[K]> };

function clean<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj)) if (obj[key] === undefined) delete obj[key];

  return obj;
}

/**
 * One portable schema description and every decision made about that description.
 *
 * Documented: [the identity card](https://fougere.dev/docs/extending/card-and-wire).
 */
export class Card<T = Values<Fields>> {
  private constructor(readonly descriptor: SchemaDescriptor) {}

  static fromSchema<TFields extends Fields>(
    schema: SchemaView<TFields>,
    name?: string,
  ): Card<Values<TFields>> {
    const fields = schema.getFields();
    const validator = InputValidator.of(fields);
    const properties: Record<string, FieldDescriptor> = {};
    const required: string[] = [];
    for (const [key, field] of Object.entries(fields)) {
      properties[key] = describeField(field, key);
      if (validator.requires(field)) required.push(key);
    }
    for (const kind of SchemaConstraints.kinds)
      for (const group of kind === 'unique' ? schema.getUnique() : schema.getIndex())
        for (const member of group) carryGroup(properties[member], kind, group);

    const descriptor: SchemaDescriptor = {
      type: 'object',
      properties,
      ...ENVELOPE,
    };
    const title = name ?? Card.titleOf(schema);
    if (title) descriptor.title = title;
    if (required.length) descriptor.required = required;

    const origin = originOf(schema);
    if (origin) descriptor['x-fougere-derived'] = origin;

    return new Card<Values<TFields>>(descriptor);
  }

  static fromDescriptor<T = Values<Fields>>(descriptor: SchemaDescriptor): Card<T> {
    return new Card<T>(descriptor);
  }

  /**
   * The entity's name.
   * Ex: `Post.pick(…)` answers `Post`.
   */
  static titleOf(schema: SchemaView): string {
    return schema.derivation?.sourceName ?? schema.name;
  }

  get origin(): DerivedFrom | undefined {
    return this.descriptor['x-fougere-derived'];
  }

  toSchema(resolve?: Resolver, name?: string): SchemaConstructor<FieldsOf<T>> {
    const descriptor = this.descriptor;
    const subject = name ? `schema '${name}'` : 'this schema';
    if (!isObject(descriptor))
      refuse(`${subject} is not an object`, 'A card carries one JSON Schema per facade.');
    const version = descriptor['x-fougere-version'];
    if (version !== 1) {
      refuse(
        `${subject} states \`x-fougere-version: ${JSON.stringify(version)}\` and this reader speaks 1`,
        'A producer and its readers move together: re-sync the consumer, or serve the version it speaks.',
      );
    }
    if (!isObject(descriptor.properties)) {
      refuse(
        `${subject} carries no \`properties\` object`,
        'A schema is its fields; there is nothing to rebuild.',
      );
    }

    const fields: Fields = {};
    const groups: Record<ConstraintKind, string[][]> = { unique: [], index: [] };
    for (const [key, property] of Object.entries(descriptor.properties)) {
      if (!isObject(property)) {
        refuse(
          `${subject} states \`${key}\` as ${JSON.stringify(property)}`,
          'A field is one JSON Schema object, and there is nothing to rebuild from that.',
        );
      }
      fields[key] = reconstructField(property, key, resolve);
      for (const kind of SchemaConstraints.kinds)
        for (const group of property['x-fougere']?.role?.[kind] ?? [])
          if (group.length > 1) groups[kind].push([...group]);
    }
    const schema = Schema.of({ fields, constraints: SchemaConstraints.of(groups) });
    const title = name ?? descriptor.title;
    if (title)
      Object.defineProperty(schema, 'name', { value: title, configurable: true });

    return schema as unknown as SchemaConstructor<FieldsOf<T>>;
  }

  /** What changed between two descriptions of the same entity — see {@link compare}. */
  diff(other: Card, options: DiffOptions = {}): Diff {
    return compare(this.descriptor, other.descriptor, options);
  }
}

function describeExtension(field: Field, key: string): FieldExtension | undefined {
  const extension: Record<string, unknown> = {};
  for (const [name, declared] of Object.entries(field.axes)) {
    const form = CardForms.find(name);
    const wire = form ? form.describe(declared, key) : declared;
    if (wire !== undefined) extension[name] = wire;
  }
  clean(extension);

  return Object.keys(extension).length ? (extension as FieldExtension) : undefined;
}

function describeField(field: Field, key: string): FieldDescriptor {
  const descriptor: FieldDescriptor = clean({ ...field.shape }) as FieldDescriptor;
  const extension = describeExtension(field, key);
  if (extension) descriptor['x-fougere'] = extension;

  return descriptor;
}

function originOf(schema: SchemaView): DerivedFrom | undefined {
  const { derivation } = schema;
  if (!derivation) return undefined;
  const nameOf = Object.fromEntries(
    Object.entries(derivation.nameOf).map(([key, value]) => [key, value ?? null]),
  );

  return { from: derivation.sourceName, nameOf };
}

function reconstructShape(property: FieldDescriptor): Field['shape'] | undefined {
  const types = Shapes.typesOf(property);
  if (!types.some((type) => type !== 'null')) return undefined;

  const { 'x-fougere': _extension, ...shape } = property;
  if (shape.items) shape.items = reconstructShape(shape.items) as FieldDescriptor;

  return clean(shape) as Field['shape'];
}

function reconstructField(
  property: FieldDescriptor,
  key: string,
  resolve?: Resolver,
): Field {
  const shape = reconstructShape(property);
  if (!shape) {
    throw new SchemaError(
      `Field '${key}' has no type in the description received from the other process.`,
    );
  }
  admitPatterns(shape, `Field '${key}'`);
  const extension = property['x-fougere'];
  const axes: Record<string, unknown> = {};
  for (const name of Axes.names) {
    const wire = (extension as Record<string, unknown> | undefined)?.[name];
    const form = CardForms.find(name);
    if (wire === undefined) continue;
    if (form) admitAxis(form, wire, `Field '${key}'`, name);
    axes[name] = form ? form.reconstruct(wire, resolve) : wire;
  }

  return new Field({ shape, ...axes } as never, key);
}

function carryGroup(
  property: FieldDescriptor | undefined,
  kind: 'unique' | 'index',
  group: readonly string[],
): void {
  if (!property) return;
  const extension = (property['x-fougere'] ??= {}) as { role?: Record<string, string[][]> };
  const role = (extension.role ??= {});
  (role[kind] ??= []).push([...group]);
}
