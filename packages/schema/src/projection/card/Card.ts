import { EXTENSION_AXES, EXTENSION_SLOTS, type Resolver } from '../../schema/axis/Axis.js';
import { dequal } from 'dequal';
import { clean, isObject } from '../../utils.js';
import { Field, type Fields } from '../../schema/fields/Field.js';
import { RowJudge } from '../../judge/RowJudge.js';
import { Schema, type SchemaConstructor } from '../../schema/Schema.js';
import type { Row, SchemaView } from '../../schema/SchemaView.js';
import { refuse } from './admission.js';
import type {
  DerivedFrom,
  FieldDescriptor,
  FieldExtension,
  SchemaDescriptor,
} from './Descriptor.js';
import type { Change, Diff, DiffOptions, RenameCandidate, TypeSet } from './diff.js';

type FieldsOf<T> = { [K in keyof T]-?: Field<T[K]> };

/** One portable schema description and every decision made about that description. */
export class Card<T = Row<Fields>> {
  private constructor(readonly descriptor: SchemaDescriptor) {}

  static fromSchema<TFields extends Fields>(
    schema: SchemaView<TFields>,
    name?: string,
  ): Card<Row<TFields>> {
    const fields = schema.getFields();
    const judge = RowJudge.of(fields);
    const properties: Record<string, FieldDescriptor> = {};
    const required: string[] = [];
    for (const [key, field] of Object.entries(fields)) {
      properties[key] = describeField(field, key);
      if (judge.onAbsent(field) === null) required.push(key);
    }

    const descriptor: SchemaDescriptor = {
      type: 'object',
      properties,
      'x-fougere-version': 1,
      'x-fougere-vendor': 'fougere',
    };
    const title = name ?? schema.derivation?.sourceName ?? schema.name;
    if (title) descriptor.title = title;
    if (required.length) descriptor.required = required;

    const origin = originOf(schema);
    if (origin) descriptor['x-fougere-derived'] = origin;
    return new Card<Row<TFields>>(descriptor);
  }

  static fromDescriptor<T = Row<Fields>>(descriptor: SchemaDescriptor): Card<T> {
    return new Card<T>(descriptor);
  }

  /** The root derivation recorded by this card, when its schema was cut from another. */
  get origin(): DerivedFrom | undefined {
    return this.descriptor['x-fougere-derived'];
  }

  /**
   * Rebuild the live schema. A bundle supplies `resolve` so relation thunks can find the
   * other reconstructed cards; a lone card deliberately falls back to a name stand-in.
   */
  toSchema(resolve?: Resolver, name?: string): SchemaConstructor<FieldsOf<T>> {
    const descriptor = this.descriptor;
    const where = name ? `schema '${name}'` : 'this schema';
    if (!isObject(descriptor))
      refuse(`${where} is not an object`, 'A card carries one JSON Schema per door.');
    const version = descriptor['x-fougere-version'];
    if (version !== 1) {
      refuse(
        `${where} states \`x-fougere-version: ${JSON.stringify(version)}\` and this reader speaks 1`,
        'A producer and its readers move together: re-sync the consumer, or serve the version it speaks.',
      );
    }
    if (!isObject(descriptor.properties)) {
      refuse(
        `${where} carries no \`properties\` object`,
        'A schema is its fields; there is nothing to rebuild.',
      );
    }

    const fields: Fields = {};
    for (const [key, property] of Object.entries(descriptor.properties)) {
      fields[key] = reconstructField(property, key, resolve);
    }
    const schema = Schema.of({ fields });
    const title = name ?? descriptor.title;
    if (title)
      Object.defineProperty(schema, 'name', { value: title, configurable: true });
    return schema as unknown as SchemaConstructor<FieldsOf<T>>;
  }

  /** What must change to turn this card into `other`. */
  diff(other: Card, options: DiffOptions = {}): Diff {
    const changes: Change[] = [];
    const renamed = options.renamed ?? {};
    const before = this.descriptor.properties ?? {};
    const after = other.descriptor.properties ?? {};
    const requiredBefore = new Set(this.descriptor.required ?? []);
    const requiredAfter = new Set(other.descriptor.required ?? []);

    // Apply a declared rename first so subsequent differences use the new field name.
    const nameAfter = (field: string): string => renamed[field] ?? field;
    const removed: string[] = [];
    for (const [field, descriptor] of Object.entries(before)) {
      const now = nameAfter(field);
      const target = after[now];
      if (target === undefined) {
        removed.push(field);
        continue;
      }

      if (now !== field)
        changes.push({ kind: 'renamed', from: field, to: now, field: target });

      const wasType = typesOf(descriptor);
      const isType = typesOf(target);
      if (!dequal(wasType, isType))
        changes.push({ kind: 'retyped', field: now, from: wasType, to: isType });
      else if (!dequal(boundsOf(descriptor), boundsOf(target))) {
        changes.push({ kind: 'reshaped', field: now, from: descriptor, to: target });
      }

      const wasRequired = requiredBefore.has(field);
      const isRequired = requiredAfter.has(now);
      if (wasRequired !== isRequired) {
        changes.push({ kind: 'required', field: now, from: wasRequired, to: isRequired });
      }
      changes.push(...restated(now, descriptor['x-fougere'], target['x-fougere']));
    }

    const claimed = new Set(Object.values(renamed));
    const added = Object.keys(after).filter(
      (field) => !(field in before) && !claimed.has(field),
    );
    for (const field of removed) {
      changes.push({
        kind: 'removed',
        field,
        from: before[field],
        required: requiredBefore.has(field),
      });
    }
    for (const field of added) {
      changes.push({
        kind: 'added',
        field,
        to: after[field],
        required: requiredAfter.has(field),
      });
    }

    return { changes, ambiguous: candidates(removed, added, before, after) };
  }
}

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

function describeField(field: Field, key: string): FieldDescriptor {
  const descriptor: FieldDescriptor = {};
  for (const [shapeKey, value] of Object.entries(field.shape)) {
    if (value !== undefined) (descriptor as Record<string, unknown>)[shapeKey] = value;
  }
  if (field.meta?.description) descriptor.description = field.meta.description;
  const extension = describeExtension(field, key);
  if (extension) descriptor['x-fougere'] = extension;
  return descriptor;
}

function originOf(schema: SchemaView): DerivedFrom | undefined {
  const { derivation } = schema;
  if (!derivation) return undefined;
  const survived = Object.fromEntries(
    Object.entries(derivation.survived).map(([key, value]) => [key, value ?? null]),
  );
  return { from: derivation.sourceName, survived };
}

function reconstructShape(property: FieldDescriptor): Field['shape'] | undefined {
  const types = Array.isArray(property.type)
    ? property.type
    : property.type
      ? [property.type]
      : [];
  const base = types.find((type) => type !== 'null');
  if (base === undefined) return undefined;
  const type = property.type as Field['shape']['type'];
  if (base === 'array') {
    const items = property.items ? reconstructShape(property.items) : undefined;
    return clean({
      type,
      items,
      minItems: property.minItems,
      maxItems: property.maxItems,
    }) as Field['shape'];
  }
  switch (base) {
    case 'string':
      return clean({
        type,
        minLength: property.minLength,
        maxLength: property.maxLength,
        pattern: property.pattern,
        enum: property.enum,
        format: property.format,
      }) as Field['shape'];
    case 'number':
    case 'integer':
      return clean({
        type,
        minimum: property.minimum,
        maximum: property.maximum,
      }) as Field['shape'];
    case 'boolean':
      return { type } as Field['shape'];
    default:
      return clean({
        type,
        properties: property.properties,
        required: property.required,
      }) as Field['shape'];
  }
}

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

function restated(
  field: string,
  before: FieldExtension | undefined,
  after: FieldExtension | undefined,
): Change[] {
  return EXTENSION_SLOTS.filter((axis) => !dequal(before?.[axis], after?.[axis])).map(
    (axis) =>
      ({
        kind: 'restated',
        field,
        axis,
        from: before?.[axis],
        to: after?.[axis],
      }) as Change,
  );
}

function shapeOf(descriptor: FieldDescriptor): Record<string, unknown> {
  const { 'x-fougere': _extension, ...shape } = descriptor;
  return shape as Record<string, unknown>;
}

function typesOf(descriptor: FieldDescriptor): TypeSet {
  const type = descriptor.type;
  if (type === undefined) return [];
  return (Array.isArray(type) ? [...type] : [type]).sort();
}

function boundsOf(descriptor: FieldDescriptor): Record<string, unknown> {
  const { type: _type, ...rest } = shapeOf(descriptor);
  return rest;
}

function candidates(
  removed: string[],
  added: string[],
  before: Record<string, FieldDescriptor>,
  after: Record<string, FieldDescriptor>,
): RenameCandidate[] {
  const found: RenameCandidate[] = [];
  for (const gone of removed) {
    for (const appeared of added) {
      if (dequal(shapeOf(before[gone]), shapeOf(after[appeared])))
        found.push({ removed: gone, added: appeared });
    }
  }
  const was = Object.keys(before);
  const now = Object.keys(after);
  const apart = ({ removed: gone, added: appeared }: RenameCandidate): number =>
    Math.abs(now.indexOf(appeared) - was.indexOf(gone));
  return found.sort((a, b) => apart(a) - apart(b));
}
