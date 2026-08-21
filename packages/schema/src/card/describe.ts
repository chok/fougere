import { clean } from '../clean.js';
import { Judge } from '../judge/Judge.js';
import { EXTENSION_AXES } from '../axis/Axis.js';
import type { Field } from '../Field.js';
import type { SchemaView } from '../SchemaView.js';
import { registrationKeyOf } from '../name.js';
import { type FieldDescriptor, type FieldExtension, type SchemaBundle, type SchemaDescriptor } from './Descriptor.js';

function describeExtension(field: Field, key: string): FieldExtension | undefined {
  const ext: Record<string, unknown> = {};
  for (const axis of EXTENSION_AXES) {
    const declared = (field as unknown as Record<string, unknown>)[axis.slot];
    if (declared === undefined) continue;
    const wire = (axis.describe as (v: unknown, k: string) => unknown)(declared, key);
    if (wire !== undefined) ext[axis.slot] = wire;
  }
  clean(ext);
  return Object.keys(ext).length ? (ext as FieldExtension) : undefined;
}

function describeField(field: Field, key: string): FieldDescriptor {
  const out: FieldDescriptor = {};
  for (const [key, value] of Object.entries(field.shape)) {
    if (value === undefined) continue;
    (out as Record<string, unknown>)[key] = value;
  }
  if (field.meta?.description) out.description = field.meta.description;
  const ext = describeExtension(field, key);
  if (ext) out['x-fougere'] = ext;
  return out;
}

export function describe(schema: SchemaView, name?: string): SchemaDescriptor {
  const properties: Record<string, FieldDescriptor> = {};
  const required: string[] = [];
  for (const [key, field] of Object.entries(schema.getFields())) {
    properties[key] = describeField(field, key);
    if (Judge.onAbsent(field) === null) required.push(key);
  }
  const descriptor: SchemaDescriptor = {
    type: 'object',
    properties,
    'x-fougere-version': 1,
    'x-fougere-vendor': 'fougere',
  };
  const title = name ?? sourceNameOf(schema);
  if (title) descriptor.title = title;
  if (required.length) descriptor.required = required;
  return descriptor;
}

export function sourceNameOf(schema: SchemaView): string | undefined {
  const s = schema as { source?: { name?: string }; name?: string };
  return s.source?.name ?? s.name;
}

export function describeSet(schemas: Record<string, SchemaView> | SchemaView[]): SchemaBundle {
  const entries = Array.isArray(schemas)
    ? schemas.map((s) => [sourceNameOf(s) ?? '', s] as const)
    : Object.entries(schemas);
  const $defs: Record<string, SchemaDescriptor> = {};
  for (const [name, schema] of entries) {
    const key = registrationKeyOf(name);
    $defs[key] = describe(schema, key);
  }
  return { $defs, 'x-fougere-version': 1, 'x-fougere-vendor': 'fougere' };
}
