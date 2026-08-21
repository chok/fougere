import { Anatomy, Role, outputFields, type Field, type SchemaView } from '@fougere/schema';

/** One field of a root type, in the shape this file reads it. */
interface RootField {
  name: string;
  type: { toString(): string };
  args: { name: string }[];
}

/** The minimum of a GraphQL schema this file reads — no `graphql` import, no second copy. */
interface Introspectable {
  getQueryType(): { getFields(): Record<string, RootField> } | null | undefined;
  getMutationType?(): { getFields(): Record<string, RootField> } | null | undefined;
}

/**
 * The scalar fields of an entity, as a GraphQL selection.
 *
 * Relations are left out: they resolve to an object, so naming one without a sub-selection
 * is a syntax error, and following it would compare a neighbour's rows rather than these.
 */
export function selectionOf(entity: SchemaView): string {
  return Object.entries(outputFields(entity.getFields()))
    .filter(([, field]) => !Role.of(field as Field).relation)
    .map(([name]) => name)
    .join(' ');
}

/**
 * The Query field that answers an operation, asked of the schema rather than recomputed.
 *
 * `pluralize` is written privately in `adapter/rest/src/routes.ts` AND in
 * `adapter/graphql/src/pothos.ts`; a third copy here would be the one that drifts. The
 * schema already states the answer, so it is read: a list is the field whose type is the
 * entity's list type, and a find is the field of the entity's own type that takes an id.
 */
export function queryFieldFor(
  schema: Introspectable,
  entity: SchemaView,
  op: 'list' | 'findById',
): string | undefined {
  const fields = schema.getQueryType()?.getFields() ?? {};
  const wanted = op === 'list' ? `${entity.name}List` : entity.name;

  for (const field of Object.values(fields)) {
    // `String(type)` gives the name with its wrappers (`Product!`, `[Product!]!`), which
    // is why this compares on inclusion rather than equality.
    const named = String(field.type).replace(/[![\]]/g, '');
    if (named !== wanted) continue;
    const takesId = field.args.some((arg) => arg.name === 'id');
    if (op === 'findById' ? takesId : !takesId) return field.name;
  }
  return undefined;
}

/** A `list` query, and the path at which its rows sit in the answer. */
export function listQuery(schema: Introspectable, entity: SchemaView): { query: string; at: string[] } | undefined {
  const field = queryFieldFor(schema, entity, 'list');
  if (!field) return undefined;
  // The list type wraps its rows — `ProductList { items }` — so the reader below has to
  // be told where to look rather than assume the answer IS the rows.
  return { query: `{ ${field} { items { ${selectionOf(entity)} } } }`, at: [field, 'items'] };
}

/** A `findById` query for one row. */
export function findQuery(schema: Introspectable, entity: SchemaView, id: string): { query: string; at: string[] } | undefined {
  const field = queryFieldFor(schema, entity, 'findById');
  if (!field) return undefined;
  return { query: `{ ${field}(id: ${JSON.stringify(id)}) { ${selectionOf(entity)} } }`, at: [field] };
}

/** Follow a path into a GraphQL answer, tolerating an absence rather than throwing. */
export function at(data: unknown, path: string[]): unknown {
  return path.reduce<unknown>((value, key) => (value as Record<string, unknown>)?.[key], data);
}

/**
 * The Mutation field that answers an operation.
 *
 * By NAME here, unlike the Query side: `createProduct` and `quote` both take a single
 * `input` argument and both return `Product!`, so their shapes do not separate them. Two
 * candidates are tried against the real fields — `<op><Entity>` for a CRUD write, and the
 * bare op for a custom one — which needs no pluralization and invents nothing.
 */
export function mutationFieldFor(schema: Introspectable, entity: SchemaView, op: string): string | undefined {
  const fields = schema.getMutationType?.()?.getFields() ?? {};
  const candidates = [`${op}${entity.name}`, op];
  return candidates.find((name) => name in fields);
}

/** A mutation, with the arguments its operation takes and where its answer sits. */
export function mutationFor(
  schema: Introspectable,
  entity: SchemaView,
  op: string,
  input: { id?: string; body?: Record<string, unknown> },
): { query: string; at: string[] } | undefined {
  const field = mutationFieldFor(schema, entity, op);
  if (!field) return undefined;

  const args: string[] = [];
  if (input.id !== undefined) args.push(`id: ${JSON.stringify(input.id)}`);
  if (input.body !== undefined) args.push(`input: ${literalOf(input.body, enumsOf(entity))}`);
  const call = args.length ? `${field}(${args.join(', ')})` : field;

  // `delete` answers a Boolean, which takes no sub-selection — asking for one is a syntax
  // error, and the schema is what says which case this is.
  const scalar = String(schema.getMutationType?.()?.getFields()[field]?.type ?? '').replace(/[!]/g, '') === 'Boolean';
  return { query: `mutation { ${call}${scalar ? '' : ` { ${selectionOf(entity)} }`} }`, at: [field] };
}

/** The fields the entity declares as a bounded set — GraphQL turns each into an enum. */
function enumsOf(entity: SchemaView): Set<string> {
  return new Set(Object.entries(entity.getFields())
    .filter(([, field]) => { const base = Anatomy.of(field.shape).base; return base?.type === 'string' && Array.isArray(base.enum); })
    .map(([name]) => name));
}

/**
 * A JS value as a GraphQL literal.
 *
 * `JSON.stringify` is not it, twice over: an input object's keys are NAMES, so
 * `{"sku": "x"}` is a syntax error where `{sku: "x"}` is the value — and an ENUM value is
 * a name too, so `status: "draft"` is refused where `status: draft` is taken. Which
 * fields are enums is read from the entity (`shape.enum`), not guessed from the string.
 */
function literalOf(value: unknown, enums: Set<string> = new Set(), key?: string): string {
  if (value === null) return 'null';
  if (key !== undefined && enums.has(key) && typeof value === 'string') return value;
  if (Array.isArray(value)) return `[${value.map((one) => literalOf(one, enums, key)).join(', ')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .map(([name, one]) => `${name}: ${literalOf(one, enums, name)}`).join(', ')}}`;
  }
  return JSON.stringify(value);
}
