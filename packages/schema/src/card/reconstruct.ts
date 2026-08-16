import { EXTENSION_AXES } from '../axis/Axis.js';
import type { Resolver } from '../axis/Axis.js';
import { Field, type Fields } from '../Field.js';
import { type EntityConstructor, type Role } from '../axis/Role.js';
import { type Shape } from '../axis/Shape.js';
import { Unique } from '../axis/Unique.js';
import { Schema, type SchemaConstructor } from '../Schema.js';
import { type SchemaView, type Row } from '../SchemaView.js';
import {
  clean,
  type FieldDescriptor,
  type RoleDescriptor,
  type SchemaBundle,
  type SchemaDescriptor,
} from './Descriptor.js';

// ─── reconstruct — card → schema (the single reconstructor) ────────

/**
 * Read a JSON Schema property back into a Fougère shape. The `type` travels
 * VERBATIM — nullability is the `[T,'null']` union on both sides, so there is
 * nothing to split; only the keyword subset of the base type is picked.
 */
function reconstructShape(prop: FieldDescriptor): Shape | undefined {
  const types = Array.isArray(prop.type) ? prop.type : prop.type ? [prop.type] : [];
  const base = types.find((t) => t !== 'null');
  if (base === undefined) return undefined;
  const type = prop.type as Shape['type'];
  // `array` with `items` is a value list, without it a `many` relation whose elements
  // live on the other side. Both are array shapes; only the role tells them apart, and
  // it travels in `x-fougere`. Nothing to branch on here — the keywords copy back.
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
    default: // 'object' or anything unrecognised → opaque value (nesting travels verbatim)
      return clean({ type, properties: prop.properties, required: prop.required }) as unknown as Shape;
  }
}



function reconstructField(prop: FieldDescriptor, key: string, resolve?: Resolver): Field {
  const ext = prop['x-fougere'];
  const shape = reconstructShape(prop);
  // A card that names no type for a property cannot become a field: every field states a
  // shape. Loud and local, at the property that is missing it — the alternative is a field
  // that judges nothing, which is what this whole rule exists to stop.
  if (!shape) {
    throw new Error(
      `Field '${key}': the card carries no \`type\` for it, so there is no shape to rebuild. `
      + `A field always states one.`,
    );
  }
  // Each axis rebuilds itself from what it wrote — the mirror of `describeExtension`.
  const axes: Record<string, unknown> = {};
  for (const axis of EXTENSION_AXES) {
    const wire = (ext as Record<string, unknown> | undefined)?.[axis.slot];
    if (wire !== undefined) {
      axes[axis.slot] = (axis.reconstruct as unknown as (w: unknown, r?: Resolver) => unknown)(wire, resolve);
    }
  }

  return new Field({
    shape,
    ...axes,
    meta: prop.description !== undefined ? { description: prop.description } : undefined,
  } as never);
}

/** Build a live schema from a card; `resolve` wires relation targets when in a bundle. */
function buildSchema(descriptor: SchemaDescriptor, resolve?: Resolver): SchemaView {
  const fields: Fields = {};
  for (const [key, prop] of Object.entries(descriptor.properties)) {
    fields[key] = reconstructField(prop, key, resolve);
  }
  // The card holds the fact once per MEMBER, so a group of two arrives twice. Nothing to
  // de-duplicate here: `getUnique()` reads the fields and does it.
  const schema = Schema.of(fields, undefined, undefined, {});

  // The name is what everything downstream keys on — the table, the GraphQL type, a
  // relation's `to`. `reconstructSet` overrides it with the bundle key, more specific.
  if (descriptor.title) {
    Object.defineProperty(schema, 'name', { value: descriptor.title, configurable: true });
  }
  return schema;
}

/**
 * The field map a stated row shape implies. A card describes rows as they are READ, so
 * `required` answers what a creation payload must carry — a question a synced consumer
 * never asks, since it calls the host rather than constructing.
 */
type FieldsOf<T> = { [K in keyof T]-?: Field<T[K]> };

/**
 * Read a lone card back into a working schema — THE single reconstructor. The result
 * carries its `~standard` (live validation) rebuilt locally: the descriptor crosses
 * the wire as data, the behaviour is reconstituted here. Relations stay name stand-ins
 * (no set to resolve against — use {@link reconstructSet} for live targets).
 *
 * `T` states the row, which is what makes a rebuilt schema a CLASS and not a type beside a
 * value: `class Post extends reconstruct<{…}>(card) {}`, one declaration carrying both.
 * Without it the instance type is an index signature, so `post.titel` compiled.
 */
export function reconstruct<T = Row<Fields>>(
  descriptor: SchemaDescriptor,
): SchemaConstructor<FieldsOf<T>> {
  return buildSchema(descriptor) as unknown as SchemaConstructor<FieldsOf<T>>;
}

/**
 * Read a whole bundle back into live schemas, keyed by name — THE set reconstructor.
 * Every entity is rebuilt against a shared `$defs` resolver, so a relation's `to()`
 * hands back the real reconstructed target (feeds adapters), not a name stand-in.
 * Targets absent from the set (external/cross-frond `$ref`) keep the stand-in.
 */
export function reconstructSet(bundle: SchemaBundle): Record<string, SchemaView> {
  const map: Record<string, EntityConstructor> = {};
  const resolve: Resolver = (name) => map[name.toLowerCase()];
  const out: Record<string, SchemaView> = {};
  for (const [name, descriptor] of Object.entries(bundle.$defs)) {
    const schema = buildSchema(descriptor, resolve);
    // Named after its key so re-describing yields the same `to`. `to` is lazy, so the map
    // need only be full before the first call — true once this loop ends.
    Object.defineProperty(schema, 'name', { value: name, configurable: true });
    map[name.toLowerCase()] = schema as unknown as EntityConstructor;
    out[name] = schema;
  }
  return out;
}
