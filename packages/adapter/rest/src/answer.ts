import { ErrorCode, FougereError, toHttpError } from '@fougere/core';
import type { ResponseResult } from '@fougere/http';
import type { RouteDefinition } from './routes/RouteDefinition.js';

/** What a route's caller sends — the path, the query string, the body, and who is calling. */
export interface RestInvocation {
  params: Record<string, string>;
  query: Record<string, unknown>;
  input: unknown;
  state: Record<string, unknown>;
}

/**
 * Call the op a route names and write what it answers as HTTP — the one place REST decides a
 * status, read off the contract and never off the op's name. Every host calls it, whoever matched
 * the route: a router by its own paths, a web host by `matchRoute`.
 */
export async function answer(route: RouteDefinition, invocation: RestInvocation): Promise<ResponseResult> {
  let result: unknown;
  try {
    result = await route.handler(invocation);
  } catch (failure) {
    return refused(failure);
  }

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

function refused(failure: unknown): ResponseResult {
  const { status, body } = toHttpError(failure);

  return { status, data: body };
}
