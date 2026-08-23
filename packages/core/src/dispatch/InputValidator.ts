import { Judge, type SchemaView } from '@fougere/schema';
import type { InvocationContext } from '../contract/Invocation.js';
import { ErrorCode, FougereError } from '../wire/errors.js';

/** Validates and decodes the input body declared by one operation contract. */
export class InputValidator {
  validate(
    schema: SchemaView | undefined,
    invocation: InvocationContext,
    entity: string,
    operation: string,
  ): InvocationContext {
    if (!schema || invocation.body === undefined || invocation.body === null) return invocation;

    const result = Judge.row(
      schema.getFields(),
      invocation.body,
      { patch: schema.getOpts().patch },
    );
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
}
