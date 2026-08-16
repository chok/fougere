import { Role } from '../axis/role/Role.js';
import { clean } from '../clean.js';
import { EXTENSION_AXES } from '../axis/Axis.js';
import type { Field, Fields } from '../Field.js';
import type { RoleRules } from '../axis/role/Role.js';
import type { SchemaView } from '../SchemaView.js';
import { Boundary } from '../axis/boundary/Boundary.js';
import { Anatomy } from '../axis/shape/Shape.js';
import { Unique } from '../axis/role/Unique.js';
import { registrationKeyOf } from '../name.js';
import { type FieldDescriptor, type FieldExtension, type RelationDescriptor, type RoleDescriptor, type SchemaBundle, type SchemaDescriptor } from './Descriptor.js';

// ─── describe — schema → card (the single canonical serialiser) ────

/**
 * A caller must supply this field: no create rule answers absence, and it is not
 * a `many` relation (absent → `[]`). Presence only — nullability is the OTHER
 * axis: a `nullable()` field stays required (the caller may supply `null`, not
 * omit the key), exactly what `Judge.row` enforces.
 */
function isRequired(field: Field): boolean {
  // Read `boundary` for the same reason `Judge.row` does: a server-owned
  // field is one a caller may never supply, so listing it as required states a
  // demand the door then refuses with `Read-only`. Same stance as OpenAPI's
  // readOnly+required, and the two readers now answer from the same axis.
  if (Boundary.of(field).readOnly) return false;
  if (field.lifecycle?.create !== undefined) return false;
  if (Role.of(field).isCollection) return false;
  return true;
}


/** Each axis describes itself; this only decides that an empty extension is no extension. */
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
  // Shape is already JSON Schema's vocabulary — nullability included, as the
  // `[T,'null']` type union — so its keywords copy verbatim (an embedded object's
  // `properties`/`required` too, themselves shape-only).
  for (const [key, value] of Object.entries(field.shape)) {
    if (value === undefined) continue;
    (out as Record<string, unknown>)[key] = value;
  }
  if (field.meta?.description) out.description = field.meta.description;
  const ext = describeExtension(field, key);
  if (ext) out['x-fougere'] = ext;
  return out;
}

/**
 * Produce the portable card for a schema — THE single canonical serialiser
 * (the hand-rolled copies in adapters call this). `name` titles the entity; it
 * falls back to the schema's source/class name when omitted.
 */
export function describe(schema: SchemaView, name?: string): SchemaDescriptor {
  const properties: Record<string, FieldDescriptor> = {};
  const required: string[] = [];
  for (const [key, field] of Object.entries(schema.getFields())) {
    properties[key] = describeField(field, key);
    if (isRequired(field)) required.push(key);
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

/**
 * The name of the schema a view came from — `Post` for `Post`, and `Post` for
 * `Post.pick('title')` too, since a derivation carries its `source`.
 *
 * Exported because two projections need the SAME answer: the card titles an entity with it,
 * and GraphQL names a field's enum type with it — an enum named after the view would give
 * `Post.status` and `CreatePostInput.status` two incompatible types for one set of values.
 */
export function sourceNameOf(schema: SchemaView): string | undefined {
  const s = schema as { source?: { name?: string }; name?: string };
  return s.source?.name ?? s.name;
}

/**
 * Describe a whole set of entities as one self-contained bundle (the `$defs`
 * document). Accepts a name→schema record or an array (names taken from the
 * schemas). Keys carry the registration key, the same spelling `describe` gives a
 * relation's `to`, so `$ref`-by-name resolves cleanly in {@link reconstructSet}.
 */
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
