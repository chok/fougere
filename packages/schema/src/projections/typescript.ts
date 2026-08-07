import type { FieldDescriptor, SchemaDescriptor } from './card.js';

/**
 * card → TypeScript source — the projection that was missing.
 *
 * `describe` turns a schema into a card and `reconstruct` turns it back into a
 * living judge, so a consumer in another repository validates by the host's rules
 * without holding its code. What it does NOT get is a type: `reconstruct` returns
 * `SchemaConstructor<Fields>`, a generic, so `post.title` is unknown to TypeScript.
 * The declaration travelled and the compiler learned nothing from it.
 *
 * So the card gets a third reader. Same input as the other two, same rule — the
 * shape IS JSON Schema, and JSON Schema has a type form.
 *
 * Deliberately NOT a JSON Schema→TS library: the input is not arbitrary JSON Schema,
 * it is a Fougère card, whose vocabulary is closed (`describe` writes it). A general
 * library would carry `$ref`, `allOf`, tuple `items`, `additionalProperties` and the
 * rest of a spec we never emit, and would still need this file to know that
 * `format: date-time` means `Date` here — a fact about our boundary, not about JSON.
 */

/** What a field's value looks like once `reconstruct` has decoded it. */
function typeOf(field: FieldDescriptor): string {
  const types = Array.isArray(field.type) ? field.type : field.type ? [field.type] : [];
  const nullable = types.includes('null');
  const base = types.find((t) => t !== 'null');
  const inner = baseTypeOf(base, field);
  return nullable ? `${inner} | null` : inner;
}

function baseTypeOf(base: string | undefined, field: FieldDescriptor): string {
  // A bounded value set IS a type — the enum travels, so the union does too.
  if (field.enum?.length) {
    return field.enum.map((v) => (v === null ? 'null' : JSON.stringify(v))).join(' | ');
  }
  switch (base) {
    case 'string':
      // `date-time` is the wire form of a value the boundary decodes to a Date, and
      // the façade now hands the decoded value on. The type says what you receive.
      return field.format === 'date-time' ? 'Date' : 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      // Two distinct things share `array`: a value list carries `items`, a bare `many`
      // relation carries none — the ids of the other side, which the card names as a
      // relation rather than a shape.
      return field.items ? `${typeOf(field.items)}[]` : 'string[]';
    case 'object':
      return field.properties ? objectTypeOf(field.properties, field.required ?? []) : 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

function objectTypeOf(properties: Record<string, FieldDescriptor>, required: readonly string[]): string {
  const members = Object.entries(properties).map(([name, field]) => {
    const optional = required.includes(name) ? '' : '?';
    return `${propertyKey(name)}${optional}: ${typeOf(field)}`;
  });
  return `{ ${members.join('; ')} }`;
}

/** Quote a key only when it is not a plain identifier — generated source stays readable. */
function propertyKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

export interface TypeSourceOptions {
  /** Name of the emitted interface. Defaults to the card's `title`, capitalized. */
  name?: string;
  /** Emit `export` before the declaration. Default: true. */
  exported?: boolean;
}

/**
 * Emit a TypeScript interface for what one card describes.
 *
 * Every property is present: `required` on a Fougère card answers "what must a CALLER
 * supply at creation", not "what is always there when read" — an `id` the system
 * generates is absent from `required` and always present on a row. Typing the read
 * shape from the create rule would make `post.id` possibly-undefined for everyone.
 */
export function typeSourceOf(descriptor: SchemaDescriptor, options: TypeSourceOptions = {}): string {
  const name = options.name ?? capitalize(descriptor.title ?? 'Schema');
  const exported = options.exported === false ? '' : 'export ';
  const properties = descriptor.properties ?? {};

  const lines = Object.entries(properties).map(([key, field]) => {
    const doc = field.description ? `  /** ${field.description} */\n` : '';
    return `${doc}  ${propertyKey(key)}: ${typeOf(field)};`;
  });

  if (lines.length === 0) return `${exported}interface ${name} {}`;
  return `${exported}interface ${name} {\n${lines.join('\n')}\n}`;
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** One operation, as much of it as a card can say. */
export interface OpDescriptor {
  name: string;
  description?: string;
  output?: SchemaDescriptor;
  /** How much `output` describes. Absent means the card did not say. */
  cardinality?: 'one' | 'maybe' | 'many' | 'page' | 'none';
}

/**
 * What one operation hands back, in TypeScript.
 *
 * `output` is the shape of a ROW; `cardinality` is how many rows. Separating them is
 * what makes this honest — `list` returns a page, not an array, and a generator that
 * assumed otherwise would have written a signature that compiles and lies.
 *
 * A page is spelled as what it IS: `ListResult<T> extends Array<T>`, an array carrying
 * its own totals. So the type is the array intersected with them, not a wrapper.
 */
function returnTypeOf(op: OpDescriptor, rowType: string): string {
  switch (op.cardinality) {
    case 'many': return `${rowType}[]`;
    case 'page': return `${rowType}[] & { total?: number; endCursor?: string; hasMore?: boolean }`;
    case 'maybe': return `${rowType} | undefined`;
    case 'one': return rowType;
    // `none` says there is no shaped output — a boolean, a void. Saying `unknown` is
    // the truth; guessing `void` would forbid reading a value that does come back.
    case 'none': return 'unknown';
    default: return 'unknown';
  }
}

/**
 * Emit the type of a façade — every operation an entity serves, as a caller meets it.
 *
 * This is what `Facade<T>` needs and what no consumer in another repository could have:
 * writing `Facade<ArticleHandler>` used to require importing the handler's class, which
 * `sync` does not carry and should not. The card carries the operations; this reads them.
 *
 * Each op takes an optional invocation and returns a promise — the door's signature, not
 * the handler's. A handler's method takes positional arguments; its door takes the call.
 */
export function facadeTypeSourceOf(
  ops: readonly OpDescriptor[],
  options: TypeSourceOptions & { rowType?: string } = {},
): string {
  const name = options.name ?? 'Facade';
  const exported = options.exported === false ? '' : 'export ';
  const rowType = options.rowType ?? 'unknown';

  const members = ops.map((op) => {
    const doc = op.description ? `  /** ${op.description} */\n` : '';
    return `${doc}  ${propertyKey(op.name)}(invocation?: Invocation): Promise<${returnTypeOf(op, rowType)}>;`;
  });

  if (members.length === 0) return `${exported}interface ${name} {}`;
  return `${exported}interface ${name} {\n${members.join('\n')}\n}`;
}
