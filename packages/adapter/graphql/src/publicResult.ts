import { GraphQLError, type ExecutionResult } from 'graphql';
import { ErrorCode, FougereError, toPublicError } from '@fougere/core';

/**
 * What a GraphQL caller may read: a refusal in its own words, and anything a resolver threw by
 * accident as `Internal error` — the rule every other door applies through `toPublicError`.
 */
export function publicResult(result: ExecutionResult): ExecutionResult {
  if (!result.errors?.length) return result;

  return { ...result, errors: result.errors.map(publicError) };
}

function publicError(error: GraphQLError): GraphQLError {
  // A syntax or validation error has no original: the document is the caller's own.
  const thrown = error.originalError;
  if (!thrown || thrown instanceof GraphQLError) return error;

  const failure = thrown instanceof FougereError
    ? thrown
    : new FougereError({ code: ErrorCode.INTERNAL_ERROR, message: thrown.message, cause: thrown });
  const { message, ...extensions } = toPublicError(failure);

  return new GraphQLError(message, {
    nodes: error.nodes,
    source: error.source,
    positions: error.positions,
    path: error.path,
    extensions: { ...error.extensions, ...extensions },
  });
}
