import {
  createField,
  type AnyField,
  type EntityConstructor,
  type Fields,
  type Role,
  type Shape,
} from '../field/index.js';
import { createSchemaConstructor, type SchemaConstructor } from '../entity.js';
import {
  clean,
  type FieldDescriptor,
  type RoleDescriptor,
  type SchemaBundle,
  type SchemaDescriptor,
} from './card.js';

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
  // `array` is two distinct things: with `items` it is a value list (a real shape);
  // without, it is a bare `many` relation marker — no shape, the role carries it.
  if (base === 'array') {
    if (!prop.items) return undefined;
    const items = reconstructShape(prop.items);
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

/**
 * Resolve a relation's `to` name to a live target. A bundle supplies one (look up the
 * `$defs` map); a lone card has none, so the relation falls back to a name stand-in.
 */
type Resolver = (name: string) => EntityConstructor | undefined;

function reconstructRole(role: RoleDescriptor, resolve?: Resolver): Role {
  const out: Role = {};
  if (role.primary) out.primary = true;
  if (role.unique) out.unique = true;
  if (role.index) out.index = true;
  if (role.relation) {
    const name = role.relation.to;
    out.relation = {
      // `to` is the `$ref` (a name). With a resolver (a bundle), it hands back the real
      // reconstructed target — adapters can read its fields. Lazy, so circular relations
      // resolve fine. Without one (a lone card), a name-only stand-in: enough to validate
      // (`kind`) and re-describe identically, but not to feed an adapter.
      to: () => resolve?.(name) ?? ({ name } as unknown as EntityConstructor),
      kind: role.relation.kind,
      ...(role.relation.onDelete ? { onDelete: role.relation.onDelete } : {}),
    };
  }
  return out;
}

function reconstructField(prop: FieldDescriptor, resolve?: Resolver): AnyField {
  const ext = prop['x-fougere'];
  return createField({
    shape: reconstructShape(prop),
    role: ext?.role ? reconstructRole(ext.role, resolve) : undefined,
    // The normal forms are pure JSON — they travelled verbatim, they read back verbatim.
    lifecycle: ext?.lifecycle,
    boundary: ext?.boundary,
    meta: prop.description !== undefined ? { description: prop.description } : undefined,
  });
}

/** Build a live schema from a card; `resolve` wires relation targets when in a bundle. */
function buildSchema(descriptor: SchemaDescriptor, resolve?: Resolver): SchemaConstructor<Fields> {
  const fields: Fields = {};
  for (const [key, prop] of Object.entries(descriptor.properties)) {
    fields[key] = reconstructField(prop, resolve);
  }
  return createSchemaConstructor(fields);
}

/**
 * Read a lone card back into a working schema — THE single reconstructor. The result
 * carries its `~standard` (live validation) rebuilt locally: the descriptor crosses
 * the wire as data, the behaviour is reconstituted here. Relations stay name stand-ins
 * (no set to resolve against — use {@link reconstructSet} for live targets).
 */
export function reconstruct(descriptor: SchemaDescriptor): SchemaConstructor<Fields> {
  return buildSchema(descriptor);
}

/**
 * Read a whole bundle back into live schemas, keyed by name — THE set reconstructor.
 * Every entity is rebuilt against a shared `$defs` resolver, so a relation's `to()`
 * hands back the real reconstructed target (feeds adapters), not a name stand-in.
 * Targets absent from the set (external/cross-frond `$ref`) keep the stand-in.
 */
export function reconstructSet(bundle: SchemaBundle): Record<string, SchemaConstructor<Fields>> {
  const map: Record<string, EntityConstructor> = {};
  const resolve: Resolver = (name) => map[name.toLowerCase()];
  const out: Record<string, SchemaConstructor<Fields>> = {};
  for (const [name, descriptor] of Object.entries(bundle.$defs)) {
    const schema = buildSchema(descriptor, resolve);
    // Name the rebuilt class after its key so re-describing it yields the same `to` name
    // (describe reads `relation.to().name`). Lazy `to` means the map need only be full
    // before any `.to()` call — true once this loop ends.
    Object.defineProperty(schema, 'name', { value: name, configurable: true });
    map[name.toLowerCase()] = schema as unknown as EntityConstructor;
    out[name] = schema;
  }
  return out;
}
