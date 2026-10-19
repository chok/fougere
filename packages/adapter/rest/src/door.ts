import { ErrorCode, FougereError, toHttpError, type Door } from '@fougere/core';
import { HttpError, type ResponseResult } from '@fougere/http';
import type { RouteDefinition } from './routes/RouteDefinition.js';

/** What a host hands the REST door for one matched route — the body still to read, so the door reads it. */
export interface RestRequest {
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: () => Promise<unknown>;
  state: Record<string, unknown>;
}

/** What a route's op is called with. */
export interface RestInvocation {
  params: Record<string, string>;
  query: Record<string, unknown>;
  input: unknown;
  state: Record<string, unknown>;
}

/**
 * REST's edges for one route: the body read within the cycle, the op called, and the answer written
 * as HTTP — the one place REST decides a status, read off the contract and never off the op's name.
 * Every host runs it, whoever matched the route: a router by its own paths, a web host by `matchRoute`.
 */
export function restDoor(route: RouteDefinition): Door<RestRequest, RestInvocation, ResponseResult> {
  return {
    name: 'rest',
    decode: async ({ params, query, body, state }) => ({ params, query, input: await read(body), state }),
    run: (invocation) => route.handler(invocation),
    encode: (outcome) => ('refused' in outcome ? refused(outcome.refused) : responseOf(route, outcome.answered)),
  };
}

/** `@fougere/http` refuses a body in its own words, since it takes no dependency on core. */
async function read(body: () => Promise<unknown>): Promise<unknown> {
  try {
    return await body();
  } catch (failure) {
    if (!(failure instanceof HttpError)) throw failure;
    throw new FougereError({ code: failure.code as ErrorCode, message: failure.message, cause: failure });
  }
}

function responseOf(route: RouteDefinition, result: unknown): ResponseResult {
  if (route.method === 'DELETE' && typeof result === 'boolean') {
    return result ? { status: route.successStatus ?? 204, data: null } : refused(notFound(route));
  }
  if (result == null && (route.cardinality === 'maybe' || route.cardinality === 'one')) return refused(notFound(route));
  if (result === undefined) return { status: route.successStatus ?? 204, data: null };

  const status = route.successStatus ?? (route.creates ? 201 : 200);
  if (route.cardinality === 'page' && Array.isArray(result)) {
    // The page-level facts ride beside the rows: on the array itself, JSON drops them.
    const page = result as unknown as { total?: number; hasMore?: boolean; endCursor?: string };

    return { status, data: { items: [...result], total: page.total, hasMore: page.hasMore, endCursor: page.endCursor } };
  }

  return { status, data: result };
}

function notFound(route: RouteDefinition): FougereError {
  return new FougereError({ code: ErrorCode.NOT_FOUND, message: `No row answers ${route.method} ${route.path}.` });
}

function refused(failure: FougereError): ResponseResult {
  const { status, body } = toHttpError(failure);

  return { status, data: body };
}
