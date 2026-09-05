import { InputValidator, type SchemaView } from '@fougere/schema';
import type { InvocationContext } from '../wire/Invocation.js';
import { ErrorCode, FougereError } from '../wire/errors.js';

/** Validates and decodes the input declared by one operation contract. */
export function validateInput(
  schema: SchemaView | undefined,
  invocation: InvocationContext,
  entity: string,
  operation: string,
): InvocationContext {
  if (!schema || invocation.input === undefined || invocation.input === null) return invocation;

  const result = InputValidator.of(schema.getFields(), { patch: schema.getOpts().patch })
    .validate(invocation.input);

  if (!result.success) {
    throw new FougereError({
      code: ErrorCode.VALIDATION_FAILED,
      message: result.errors.map((error) => `${error.path}: ${error.message}`).join(', '),
      details: result.errors,
      entity,
      operation,
    });
  }

  return { ...invocation, input: result.data };
}
