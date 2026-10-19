import { ErrorCode, FougereError, toHttpError, type Door } from '@fougere/core';
import { HttpError, type ResponseResult } from '@fougere/http';
import { getOperationAST, graphql, parse, type ExecutionResult, type GraphQLSchema } from 'graphql';
import { publicResult } from './publicResult.js';

/** A document, its variables, and which operation of it to run. */
export interface GraphQLDocument {
  query?: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

/** What a host hands the GraphQL door — the document still to read, so the door reads it. */
export interface GraphQLReceived {
  /** A POST's body, or a GET's query string. */
  document: () => Promise<GraphQLDocument | undefined>;
  /** GET is the cacheable half of the protocol, so a mutation over it is refused rather than run. */
  readOnly?: boolean;
  state: Record<string, unknown>;
}

/**
 * GraphQL's edges over one schema: the document read within the cycle, run by the engine — whose
 * resolvers make one call per root field and per relation, all within this request — and the
 * result written as GraphQL-over-HTTP, a refusal before the engine as a status and an `errors` list.
 */
export function graphqlDoor(schema: GraphQLSchema): Door<GraphQLReceived, GraphQLDocument & { query: string; state: Record<string, unknown> }, ResponseResult> {
  return {
    name: 'graphql',
    decode: async ({ document, readOnly, state }) => {
      const read = await documentOf(document);
      if (!read?.query) throw new FougereError({ code: ErrorCode.BAD_REQUEST, message: 'Missing query' });
      if (readOnly) refuseMutation(read.query, read.operationName);

      return { ...read, query: read.query, state };
    },
    run: async ({ query, variables, operationName, state }) => graphql({
      schema,
      source: query,
      variableValues: variables,
      operationName,
      contextValue: { state },
    }),
    encode: (outcome): ResponseResult => {
      if ('answered' in outcome) {
        return { status: 200, data: publicResult(outcome.answered as ExecutionResult), headers: { 'content-type': 'application/json' } };
      }
      const { status, body } = toHttpError(outcome.refused);

      const refused: ResponseResult = { status, data: { errors: [{ message: body.message, extensions: { code: body.code } }] } };

      return status === 405 ? { ...refused, headers: { allow: 'POST' } } : refused;
    },
  };
}

/** `@fougere/http` refuses a body in its own words, since it takes no dependency on core. */
async function documentOf(document: () => Promise<GraphQLDocument | undefined>): Promise<GraphQLDocument | undefined> {
  try {
    return await document();
  } catch (failure) {
    if (!(failure instanceof HttpError)) throw failure;
    throw new FougereError({ code: failure.code as ErrorCode, message: failure.message, cause: failure });
  }
}

function refuseMutation(query: string, operationName: string | undefined): void {
  let parsed;
  try {
    parsed = parse(query);
  } catch (cause) {
    throw new FougereError({ code: ErrorCode.BAD_REQUEST, message: (cause as Error).message, cause });
  }

  const operation = getOperationAST(parsed, operationName);
  if (operation && operation.operation !== 'query') {
    throw new FougereError({ code: ErrorCode.METHOD_NOT_ALLOWED, message: 'Only GraphQL queries may be executed over GET' });
  }
}
