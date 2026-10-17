import { type FrondDescriptor, type OperationContract } from '@fougere/core/descriptor';
import { ANONYMOUS_SCHEMA_NAME, Card, type SchemaView } from '@fougere/schema';
import type { Aliases } from './Aliases.js';

/** A value that ends up as an import in the module being written. */
export type Live = object;

export const lit = (value: unknown): string => JSON.stringify(value ?? null);

/** What a schema slot becomes in the generated module. */
export function schemaRef(
  schema: SchemaView | undefined,
  declaredIn: string,
  imports: Aliases,
): string | undefined {
  if (!schema) return undefined;
  const known = imports.aliasOf(schema as Live);
  if (known) return known;

  const derived = derivationOf(schema, imports);
  if (derived) return derived;

  const name = (schema as { name?: string }).name;
  if (name && name !== ANONYMOUS_SCHEMA_NAME) return imports.named(schema as Live, declaredIn, name);

  const card = Card.fromSchema(schema);
  const source = card.origin?.from ?? card.descriptor.title;
  const from = source ? imports.classNamed(source) : undefined;
  if (from) return `${imports.aliasOf(from)}.partial()`;

  throw new Error(
    `A scan cannot be written down: an anonymous schema in ${declaredIn} names no source. `
    + 'Only `Partial<X>` is derivable here, and it says which X it came from.',
  );
}

/**
 * A view cut from an entity this module imports, written as the cut — `Note.pick("title")`. It
 * carries its own name, so read by name it came back as the whole entity: five fields where the
 * config had stated one. A field with no origin (an `extend`) cannot be written, and is left to
 * the reading by name.
 */
function derivationOf(schema: SchemaView, imports: Aliases): string | undefined {
  const derivation = schema.derivation;
  const alias = derivation ? imports.aliasOf(derivation.source as Live) : undefined;
  if (!derivation || !alias) return undefined;

  const originOf = new Map(Object.entries(derivation.nameOf).flatMap(([origin, here]) => (here ? [[here, origin] as const] : [])));
  const fields = Object.keys(schema.getFields());
  if (fields.some((field) => !originOf.has(field))) return undefined;

  const kept = fields.map((field) => originOf.get(field)!);
  const renamed = fields.filter((field) => originOf.get(field) !== field);
  const whole = Object.keys(derivation.source.getFields()).length === kept.length;

  return alias
    + (whole ? '' : `.pick(${kept.map(lit).join(', ')})`)
    + (renamed.length ? `.rename(${lit(Object.fromEntries(renamed.map((field) => [originOf.get(field), field])))})` : '')
    + (schema.getOpts().patch ? '.partial()' : '');
}

/** One entry of an operations Map, as its module spells it. */
export function contractOf(
  op: string,
  contract: OperationContract,
  declaredIn: string,
  imports: Aliases,
): string {
  const parts: string[] = [];
  const input = schemaRef(contract.input, declaredIn, imports);
  const output = schemaRef(contract.output, declaredIn, imports);
  if (input) parts.push(`input: ${input}`);
  if (output) parts.push(`output: ${output}`);
  if (contract.binding !== undefined) parts.push(`binding: ${lit(contract.binding)}`);
  if (contract.description !== undefined) parts.push(`description: ${lit(contract.description)}`);
  if (contract.cardinality !== undefined) parts.push(`cardinality: ${lit(contract.cardinality)}`);
  if (contract.signature !== undefined) parts.push(`signature: ${lit(contract.signature)}`);
  // Written down like every other member: a scan on disk is what an edge deployment reads, and
  // a contract that loses a field there answers differently depending on how it was booted.
  if (contract.errors !== undefined) parts.push(`errors: ${lit(contract.errors)}`);

  return `[${lit(op)}, { ${parts.join(', ')} }]`;
}

/** The operations of one handler, as the Map its reader builds. */
export function operationsOf(
  operations: ReadonlyMap<string, OperationContract>,
  declaredIn: string,
  imports: Aliases,
  indent: string,
): string {
  const ops = [...operations].map((entry) => contractOf(entry[0], entry[1], declaredIn, imports));

  return `new Map([\n${indent}  ${ops.join(`,\n${indent}  `)}\n${indent}])`;
}

/**
 * What `frond.config.ts` says per op, written down with the rest: a host booting from this module
 * never reads that file, so an op whose kind it states was refused there and booted in dev.
 */
export function overridesOf(f: FrondDescriptor, imports: Aliases): string {
  const declaredIn = `${f.source.path}/frond.config.ts`;
  const entries = Object.entries(f.operationsOverrides ?? {}).map(([key, { input, output, ...rest }]) => {
    const views = [
      input ? `input: ${schemaRef(input, declaredIn, imports)}` : '',
      output ? `output: ${schemaRef(output, declaredIn, imports)}` : '',
    ].filter(Boolean);

    return `${lit(key)}: { ${[...views, `...${lit(rest)}`].join(', ')} }`;
  });

  return `{ ${entries.join(', ')} }`;
}
