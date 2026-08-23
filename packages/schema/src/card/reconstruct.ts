import { clean } from '../clean.js';
import { isObject, refuse } from '../judge/form.js';
import { EXTENSION_AXES } from '../axis/Axis.js';
import type { Resolver } from '../axis/Axis.js';
import { Field, type Fields } from '../Field.js';
import { type EntityConstructor } from '../axis/role/Relation.js';
import { type Shape } from '../axis/shape/Shape.js';
import { Schema, type SchemaConstructor } from '../Schema.js';
import { type SchemaView, type Row } from '../SchemaView.js';
import { type FieldDescriptor, type SchemaBundle, type SchemaDescriptor } from './Descriptor.js';

function reconstructShape(prop: FieldDescriptor): Shape | undefined {
  const types = Array.isArray(prop.type) ? prop.type : prop.type ? [prop.type] : [];
  const base = types.find((t) => t !== 'null');
  if (base === undefined) return undefined;
  const type = prop.type as Shape['type'];
  if (base === 'array') {
    const items = prop.items ? reconstructShape(prop.items) : undefined;
    return clean({ type, items, minItems: prop.minItems, maxItems: prop.maxItems }) as unknown as Shape;
  }
  switch (base) {
    case 'string':
      return clean({ type, minLength: prop.minLength, maxLength: prop.maxLength, pattern: prop.pattern, enum: prop.enum, format: prop.format }) as Shape;
    case 'number':
    case 'integer':
      return clean({ type, minimum: prop.minimum, maximum: prop.maximum }) as Shape;
    case 'boolean':
      return { type } as Shape;
    default: 
      return clean({ type, properties: prop.properties, required: prop.required }) as unknown as Shape;
  }
}

function reconstructField(prop: FieldDescriptor, key: string, resolve?: Resolver): Field {
  const ext = prop['x-fougere'];
  const shape = reconstructShape(prop);
  if (!shape) {
    throw new Error(
      `Field '${key}': the card carries no \`type\` for it, so there is no shape to rebuild. `
      + `A field always states one.`,
    );
  }
  const axes: Record<string, unknown> = {};
  for (const axis of EXTENSION_AXES) {
    const wire = (ext as Record<string, unknown> | undefined)?.[axis.slot];
    if (wire !== undefined) {
      axes[axis.slot] = axis.reconstruct(wire, resolve);
    }
  }

  return new Field({
    shape,
    ...axes,
    meta: prop.description !== undefined ? { description: prop.description } : undefined,
  } as never);
}

function buildSchema(descriptor: SchemaDescriptor, resolve?: Resolver, name?: string): SchemaView {
  const where = name ? `schema '${name}'` : 'this schema';
  if (!isObject(descriptor)) refuse(`${where} is not an object`, 'A card carries one JSON Schema per door.');
  const version = descriptor['x-fougere-version'];
  if (version !== 1) {
    refuse(
      `${where} states \`x-fougere-version: ${JSON.stringify(version)}\` and this reader speaks 1`,
      'A producer and its readers move together: re-sync the consumer, or serve the version it speaks.',
    );
  }
  if (!isObject(descriptor.properties)) {
    refuse(`${where} carries no \`properties\` object`, 'A schema is its fields; there is nothing to rebuild.');
  }
  const fields: Fields = {};
  for (const [key, prop] of Object.entries(descriptor.properties)) {
    fields[key] = reconstructField(prop, key, resolve);
  }
  const schema = Schema.of(fields, undefined, undefined, {});

  const title = name ?? descriptor.title;
  if (title) Object.defineProperty(schema, 'name', { value: title, configurable: true });
  return schema;
}

type FieldsOf<T> = { [K in keyof T]-?: Field<T[K]> };

export function reconstruct<T = Row<Fields>>(
  descriptor: SchemaDescriptor,
): SchemaConstructor<FieldsOf<T>> {
  return buildSchema(descriptor) as unknown as SchemaConstructor<FieldsOf<T>>;
}

export function reconstructSet(bundle: SchemaBundle): Record<string, SchemaView> {
  const map: Record<string, EntityConstructor> = {};
  const resolve: Resolver = (name) => map[name.toLowerCase()];
  const out: Record<string, SchemaView> = {};
  for (const [name, descriptor] of Object.entries(bundle.$defs)) {
    const schema = buildSchema(descriptor, resolve, name);
    map[name.toLowerCase()] = schema as unknown as EntityConstructor;
    out[name] = schema;
  }
  return out;
}
