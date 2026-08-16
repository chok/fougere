import type { Field, Fields, Role } from '../field/index.js';
import type { SchemaView } from '../schema/index.js';
import { Boundary, Anatomy, Unique } from '../field/index.js';
import { registrationKeyOf } from '../name.js';
import {
  clean,
  type FieldDescriptor,
  type FieldExtension,
  type RelationDescriptor,
  type RoleDescriptor,
  type SchemaBundle,
  type SchemaDescriptor,
} from './card.js';

// ─── describe — schema → card (the single canonical serialiser) ────

/**
 * A caller must supply this field: no create rule answers absence, and it is not
 * a `many` relation (absent → `[]`). Presence only — nullability is the OTHER
 * axis: a `nullable()` field stays required (the caller may supply `null`, not
 * omit the key), exactly what `validateFields` enforces.
 */
function isRequired(field: Field): boolean {
  // Read `boundary` for the same reason `validateFields` does: a server-owned
  // field is one a caller may never supply, so listing it as required states a
  // demand the door then refuses with `Read-only`. Same stance as OpenAPI's
  // readOnly+required, and the two readers now answer from the same axis.
  if (Boundary.of(field).readOnly) return false;
  if (field.lifecycle?.create !== undefined) return false;
  if (field.role?.relation?.kind === 'many') return false;
  return true;
}

function describeRole(role: Role, key: string): RoleDescriptor | undefined {
  const out: RoleDescriptor = {};
  if (role.primary) out.primary = true;
  // Members are spelled out on the wire: a consumer has no way to know which field a rule
  // hangs on. Past `entity()` they are already named; `key` covers a field built by hand.
  const unique = (role.rules ?? []).filter((rule) => rule instanceof Unique);
  if (unique.length) out.unique = unique.map((rule) => [...rule.resolvedOn(key).members]);
  if (role.index) out.index = true;
  if (role.relation) {
    out.relation = clean({
      to: registrationKeyOf((role.relation.to() as { name?: string }).name ?? ''), // thunk → name
      kind: role.relation.kind,
      onDelete: role.relation.onDelete,
    }) as RelationDescriptor;
  }
  return Object.keys(out).length ? out : undefined;
}

function describeExtension(field: Field, key: string): FieldExtension | undefined {
  const ext: FieldExtension = {};
  if (field.role) ext.role = describeRole(field.role, key);
  // The normal forms are named tokens, pure JSON — they travel verbatim
  // (a custom generator travels by NAME, re-resolved against the consumer's registry).
  if (field.lifecycle) ext.lifecycle = field.lifecycle;
  // Carry only an explicit override; the derived default (date → isoDate) is
  // re-derived from `shape.format` on reconstruction (convention over config).
  if (field.boundary !== undefined) ext.boundary = field.boundary;
  clean(ext as Record<string, unknown>);
  return Object.keys(ext).length ? ext : undefined;
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
