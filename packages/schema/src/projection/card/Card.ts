import { EXTENSION_AXES, type Resolver } from '../../axis/Axis.js';
import { clean, isObject } from '../../lib/utils.js';
import { Field, type Fields } from '../../field/Field.js';
import { SchemaConstraints } from '../../SchemaDefinition.js';
import { InputValidator } from '../../validator/InputValidator.js';
import { Schema, type SchemaConstructor } from '../../Schema.js';
import type { Values, SchemaView } from '../../SchemaView.js';
import { admitPatterns, refuse } from './admission.js';
import type {
  DerivedFrom,
  FieldDescriptor,
  FieldExtension,
  SchemaDescriptor,
} from './Descriptor.js';
import { compare, type Diff, type DiffOptions } from './diff.js';

type FieldsOf<T> = { [K in keyof T]-?: Field<T[K]> };

/** One portable schema description and every decision made about that description. */
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
      if (validator.onAbsent(field) === null) required.push(key);
    }
    for (const group of schema.getUnique() ?? [])
      for (const member of group) carryGroup(properties[member], group);

    const descriptor: SchemaDescriptor = {
      type: 'object',
      properties,
      'x-fougere-version': 1,
      'x-fougere-vendor': 'fougere',
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
   * A derivation answers the name it was cut from — `Post.pick('title')` is `Post`, since
   * a derived class carries `Schema`.
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
      refuse(`${subject} is not an object`, 'A card carries one JSON Schema per door.');
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
    const groups: string[][] = [];
    for (const [key, property] of Object.entries(descriptor.properties)) {
      if (!isObject(property)) {
        refuse(
          `${subject} states \`${key}\` as ${JSON.stringify(property)}`,
          'A field is one JSON Schema object, and there is nothing to rebuild from that.',
        );
      }
      fields[key] = reconstructField(property, key, resolve);
      for (const group of property['x-fougere']?.role?.unique ?? [])
        if (group.length > 1) groups.push([...group]);
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

/**
 * So the three axes write themselves under `x-fougere`, each by its own hand.
 * FR : pour que les trois axes s'écrivent sous `x-fougere`, chacun de sa main.
 * `ref(User)` → `{ role: { relation: { to: 'user', kind: 'one' } } }`
 */
function describeExtension(field: Field, key: string): FieldExtension | undefined {
  const extension: Record<string, unknown> = {};
  for (const axis of EXTENSION_AXES) {
    const declared = (field as unknown as Record<string, unknown>)[axis.slot];
    if (declared === undefined) continue;
    const wire = axis.describe(declared, key);
    if (wire !== undefined) extension[axis.slot] = wire;
  }
  clean(extension);
  return Object.keys(extension).length ? (extension as FieldExtension) : undefined;
}

/**
 * So the shape stays plain JSON Schema, and what is ours sits under one key.
 * FR : pour que la forme reste du JSON Schema, ce qui est à nous tenant sous une clé.
 * `text({ max: 200 })` → `{ type: 'string', maxLength: 200 }`
 */
function describeField(field: Field, key: string): FieldDescriptor {
  // The shape IS JSON Schema, so it lands whole rather than key by key — which is what let
  // it be copied under a computed key into a type that names its own.
  const descriptor: FieldDescriptor = clean({ ...field.shape }) as FieldDescriptor;
  if (field.meta?.description) descriptor.description = field.meta.description;
  const extension = describeExtension(field, key);
  if (extension) descriptor['x-fougere'] = extension;
  return descriptor;
}

/**
 * So a derived card names its root and what became of each field.
 * FR : pour qu'une carte dérivée nomme sa racine et le sort de chaque champ.
 * `Post.pick('title')` → `{ from: 'Post', nameOf: { title: 'title' } }`
 */
function originOf(schema: SchemaView): DerivedFrom | undefined {
  const { derivation } = schema;
  if (!derivation) return undefined;
  const nameOf = Object.fromEntries(
    Object.entries(derivation.nameOf).map(([key, value]) => [key, value ?? null]),
  );
  return { from: derivation.sourceName, nameOf };
}

/**
 * So a shape read back is the shape that was written, and an unknown type is refused.
 * FR : pour qu'une forme relue soit celle qui a été écrite, un type inconnu étant refusé.
 * `{ type: 'string', maxLength: 200 }` → the same shape a `text({ max: 200 })` states
 */
function reconstructShape(property: FieldDescriptor): Field['shape'] | undefined {
  const types = Array.isArray(property.type) ? property.type : property.type ? [property.type] : [];
  if (!types.some((type) => type !== 'null')) return undefined;

  // `describeField` writes the shape whole, so it is read whole: a list of keywords here
  // would be a second inventory, and the one that forgets a keyword loses it in silence.
  const { 'x-fougere': _extension, description: _description, ...shape } = property;
  if (shape.items) shape.items = reconstructShape(shape.items) as FieldDescriptor;

  return clean(shape) as Field['shape'];
}

/**
 * So a field read back carries its axes, rebuilt by the axes themselves.
 * FR : pour qu'un champ relu porte ses axes, reconstruits par les axes eux-mêmes.
 * `{ 'x-fougere': { lifecycle: { create: 'now' } } }` → a field stamped at create
 */
function reconstructField(
  property: FieldDescriptor,
  key: string,
  resolve?: Resolver,
): Field {
  const shape = reconstructShape(property);
  if (!shape) {
    throw new Error(
      `Field '${key}': the card carries no \`type\` for it, so there is no shape to rebuild. ` +
        'A field always states one.',
    );
  }
  admitPatterns(shape, `Field '${key}'`);
  const extension = property['x-fougere'];
  const axes: Record<string, unknown> = {};
  for (const axis of EXTENSION_AXES) {
    const wire = (extension as Record<string, unknown> | undefined)?.[axis.slot];
    if (wire !== undefined) axes[axis.slot] = axis.reconstruct(wire, resolve);
  }
  return new Field({
    shape,
    ...axes,
    meta:
      property.description !== undefined
        ? { description: property.description }
        : undefined,
  } as never);
}

/**
 * So an axis that changed is one named difference, not a whole field marked dirty.
 * FR : pour qu'un axe modifié soit une différence nommée, pas un champ entier marqué.
 * `{ kind: 'restated', field: 'body', axis: 'boundary', … }`
 */
/**
 * So a group spanning several fields reaches a reader that only ever sees one field.
 * FR : pour qu'un groupe couvrant plusieurs champs atteigne un lecteur qui n'en voit qu'un.
 * `carryGroup(properties.listId, ['listId', 'docId'])` → the pair lands under its `role`
 */
function carryGroup(property: FieldDescriptor | undefined, group: readonly string[]): void {
  if (!property) return;
  const extension = (property['x-fougere'] ??= {}) as { role?: { unique?: string[][] } };
  const role = (extension.role ??= {});
  (role.unique ??= []).push([...group]);
}
