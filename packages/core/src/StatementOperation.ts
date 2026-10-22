import { FieldSet, type SchemaView } from '@fougere/schema';
import type { OperationContract } from './wire/OperationContract.js';
import type { Param } from './wire/Param.js';
import type { TypeRef } from './wire/TypeRef.js';

/** What a parameter is — a schema, a field of an entity (`[Post, 'id']`), a primitive, or `State`, the caller's kept state. */
export type StatementType = SchemaView | readonly [SchemaView, string] | 'string' | 'number' | 'boolean' | 'State';

/** A parameter, required unless it says otherwise. */
export type StatementParam = StatementType | { type: StatementType; optional: true };

/**
 * An operation written by hand: what TypeScript erases of its method, stated, and nothing guessed.
 * `publish: { params: { id: [Post, 'id'] }, output: Post }` — `[Post]` answers several, and the kind
 * is told by the verb the name leads with, the way it is for every operation.
 */
export interface StatementOperation {
  /** Every parameter, in the order the method takes them. */
  params: Record<string, StatementParam>;
  /** What the request body is judged against. */
  input?: SchemaView;
  /** What the operation answers — `[Post]` for several. */
  output?: SchemaView | readonly [SchemaView];
  description?: string;
}

export const isStatementOperation = (value: unknown): value is StatementOperation =>
  typeof value === 'object' && value !== null && 'params' in value;

function typeRefOf(type: StatementType): TypeRef {
  if (typeof type === 'string') return { raw: type, name: type };
  if (!Array.isArray(type)) return { raw: (type as SchemaView).name, name: (type as SchemaView).name };

  const [entity, field] = type as readonly [SchemaView, string];
  const declared = entity.getFields()[field];
  if (!declared) throw new Error(`${entity.name} has no field '${field}', so [${entity.name}, '${field}'] names nothing.`);
  const shape = declared.shape as { type?: string };

  return {
    raw: `${entity.name}['${field}']`,
    name: typeof shape.type === 'string' ? shape.type : 'string',
    field: { entity: entity.name, name: field },
    ...(FieldSet.of(entity.getFields()).primary === field ? { identifies: entity.name } : {}),
  };
}

/** The contract the scan would have read off the method, from what the author stated. */
export function contractOf(name: string, operation: StatementOperation): OperationContract {
  const params: Param[] = Object.entries(operation.params).map(([param, declared]) => {
    const optional = typeof declared === 'object' && declared !== null && !Array.isArray(declared) && 'optional' in declared;

    return {
      name: param,
      type: typeRefOf(optional ? (declared as { type: StatementType }).type : declared as StatementType),
      ...(optional ? { optional: true } : {}),
    };
  });
  const several = Array.isArray(operation.output);
  const output = several ? (operation.output as readonly [SchemaView])[0] : operation.output as SchemaView | undefined;

  return {
    signature: { name, params, ...(operation.description ? { description: operation.description } : {}) },
    ...(operation.input ? { input: operation.input } : {}),
    ...(output ? { output, cardinality: several ? 'many' : 'one' } : { cardinality: 'none' }),
    ...(operation.description ? { description: operation.description } : {}),
  };
}
