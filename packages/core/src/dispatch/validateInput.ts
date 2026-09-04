import { RowJudge, type SchemaView } from '@fougere/schema';
import type { InvocationContext } from '../wire/Invocation.js';
import { ErrorCode, FougereError } from '../wire/errors.js';

/** Validates and decodes the input body declared by one operation contract. */
export function validateInput(
  schema: SchemaView | undefined,
  invocation: InvocationContext,
  entity: string,
  operation: string,
): InvocationContext {
  if (!schema || invocation.body === undefined || invocation.body === null) return invocation;

  const result = RowJudge.of(schema.getFields(), { patch: schema.getOpts().patch })
    .validate(invocation.body);

  if (!result.success) {
    throw new FougereError({
      code: ErrorCode.VALIDATION_FAILED,
      message: result.errors.map((error) => `${error.path}: ${error.message}`).join(', '),
      details: result.errors,
      entity,
      operation,
    });
  }

  return { ...invocation, body: result.data };
}
