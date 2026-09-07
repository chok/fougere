/** An operation contract, written down — the half two emitters say the same way. */
import { ANONYMOUS_SCHEMA_NAME, Card, type SchemaView } from '@fougere/schema';

import type { OperationContract } from '../wire/operation.js';

/** A value that ends up as an import in the module being written. */
export type Live = object;

/**
 * What the writer needs of an emitter's imports, and nothing more.
 *
 * The two emitters index theirs differently — one by value against a relative path, one
 * by file against the package specifier a project already uses — and neither is wrong for
 * the module it writes. What they agree on is this: a value already imported has an
 * alias, a class can be imported by name, and an entity can be found by its class name.
 */
export interface Aliases {
  aliasOf(value: Live): string | undefined;
  named(value: Live, filePath: string, name: string): string;
  /** The entity class this name belongs to — what a `Partial<X>` names as its source. */
  classNamed(name: string): Live | undefined;
}

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
