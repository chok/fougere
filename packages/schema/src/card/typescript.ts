import type { FieldDescriptor, SchemaDescriptor } from './Descriptor.js';

/**
 * card → TypeScript source. `reconstruct` gives a consumer a living judge; this gives it
 * the type, so `post.title` is `string` rather than `any` and `post.titel` fails.
 *
 * Deliberately NOT a JSON Schema→TS library: the input is a Fougère card, whose vocabulary
 * is closed. A general one would carry `$ref`, `allOf` and the rest we never emit, and
 * would still need this file to know `format: date-time` means `Date` — a fact about our
 * boundary, not about JSON.
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
      // `date-time` is the wire form of a value the boundary decodes; the type says what
      // you receive, not what travelled.
      return field.format === 'date-time' ? 'Date' : 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      // `array` covers two things: a value list carries `items`, a `many` relation carries
      // none — the ids of the other side.
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

/**
 * A description lands INSIDE a comment, and a card can come from a stranger.
 *
 * `identifierOf` already refuses a name for this reason — a name stops being data when it
 * lands in a declaration. So does a description: `*\/` ends the comment, and everything
 * after it is source. A card carrying `*\/ } console.log(…); interface X {` produced a file
 * that compiled with zero diagnostics and emitted a top-level statement, which `fougere
 * sync` then wrote into the consumer's repository for its next import to run.
 *
 * Escaped rather than refused, unlike a name: a description is prose, and prose contains
 * `*\/` legitimately (a sentence about a comment, a regex). `*\/` renders the same to a
 * reader and terminates nothing, so the text survives and the exit does not.
 */
function docCommentOf(text: string | undefined, indent: string): string {
  if (!text) return '';
  return `${indent}/** ${text.replace(/\*\//g, '*\\/')} */\n`;
}

export interface TypeSourceOptions {
  /** Name of the emitted interface. Defaults to the card's `title`, capitalized. */
  name?: string;
  exported?: boolean;
}

/**
 * The anonymous object type one card describes — the members, nothing around them.
 * Internal: `entitySourceOf` is what a consumer calls, and it emits this above the judge.
 *
 * Every property is present: `required` on a Fougère card answers "what must a CALLER
 * supply at creation", not "what is always there when read" — an `id` the system
 * generates is absent from `required` and always present on a row. Typing the read
 * shape from the create rule would make `post.id` possibly-undefined for everyone.
 */
export function shapeTypeOf(descriptor: SchemaDescriptor, indent = ''): string {
  const entries = Object.entries(descriptor.properties ?? {});
  if (entries.length === 0) return '{}';

  const lines = entries.map(([key, field]) => {
    const doc = docCommentOf(field.description, `${indent}  `);
    return `${doc}${indent}  ${propertyKey(key)}: ${typeOf(field)};`;
  });
  return `{\n${lines.join('\n')}\n${indent}}`;
}

/**
 * Emit the entity a card describes — ONE class, judge and shape together, because a class
 * is the language's own answer to "a name that is both a value and a type".
 *
 * The card travels inline, so the rebuilt judge and the shape above it read off the same
 * source. Requires `reconstruct` in scope: only the caller knows how the consumer imports.
 */
export function entitySourceOf(descriptor: SchemaDescriptor, options: TypeSourceOptions = {}): string {
  const name = identifierOf(options.name ?? capitalize(descriptor.title ?? 'Schema'));
  const exported = options.exported === false ? '' : 'export ';
  const card = JSON.stringify(descriptor, null, 2)
    .split('\n')
    .map((line, i) => (i === 0 ? line : `  ${line}`))
    .join('\n');

  return `${exported}class ${name} extends reconstruct<${shapeTypeOf(descriptor)}>(${card}) {}`;
}

/**
 * A card names itself, and a card can come from a stranger. Everything else here emits
 * data — a string lands inside `JSON.stringify` — but a name lands in a DECLARATION,
 * so it is the one value that could stop being data. Refuse it here as well as at the
 * caller: the projection should not depend on who calls it to be safe.
 */
function identifierOf(name: string): string {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
    throw new Error(`'${name}' is not a TypeScript identifier — it cannot name a generated declaration`);
  }
  return name;
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

/** Emit the type of a façade — every operation an entity serves, as a callable surface. */
export function facadeTypeSourceOf(
  ops: readonly OpDescriptor[],
  options: TypeSourceOptions & { rowType?: string } = {},
): string {
  const name = options.name ?? 'Facade';
  const exported = options.exported === false ? '' : 'export ';
  const rowType = options.rowType ?? 'unknown';

  const members = ops.map((op) => {
    const doc = docCommentOf(op.description, '  ');
    return `${doc}  ${propertyKey(op.name)}(invocation?: Invocation): Promise<${returnTypeOf(op, rowType)}>;`;
  });

  if (members.length === 0) return `${exported}interface ${name} {}`;
  return `${exported}interface ${name} {\n${members.join('\n')}\n}`;
}
