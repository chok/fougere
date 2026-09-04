import { Shapes, Role, Visibility, type Field, type SchemaView } from '@fougere/schema';

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

/** The scalar fields of an entity, as a GraphQL selection. */
export function selectionOf(entity: SchemaView): string {
  return Object.entries(Visibility.of(entity.getFields()).output)
    .filter(([, field]) => !Role.of(field as Field).relation)
    .map(([name]) => name)
    .join(' ');
}

/** The Query field that answers an operation, asked of the schema rather than recomputed. */
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

/** The Mutation field that answers an operation. */
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
    .filter(([, field]) => { const base = Shapes.of(field.shape).base; return base?.type === 'string' && Array.isArray(base.enum); })
    .map(([name]) => name));
}

/** A JS value as a GraphQL literal. */
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
