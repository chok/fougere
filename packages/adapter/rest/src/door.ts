import { DoorMiddleware, ErrorCode, FougereError, toHttpError, type Door } from '@fougere/core';
import { HttpError, type HttpCarrier, type ResponseResult } from '@fougere/http';
import type { RouteDefinition } from './routes/RouteDefinition.js';

/** What a host hands the REST door for one matched route — the body still to read, so the door reads it. */
export interface RestRequest {
  /** The op the route names — what a middleware bound to a handler stands around. */
  operation: string;
  headers: Headers;
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: () => Promise<unknown>;
  state: Record<string, unknown>;
}

/**
 * An answer a REST middleware may give in the op's place, declared in its return type — the status
 * and the headers are what the contract reads, in the vocabulary of OpenAPI's `responses`.
 */
export interface RestResponse<Status extends number, Headers extends Record<string, string> = Record<never, string>, Body = null>
  extends ResponseResult {
  status: Status;
  headers: Headers;
  data: Body;
}

type HandlerClass = abstract new (...args: never[]) => unknown;

/** A REST middleware standing around its whole frond: `class Powered extends RestMiddleware()`. */
export function RestMiddleware(): abstract new () => DoorMiddleware<RestRequest, ResponseResult>;
/**
 * A REST middleware standing around one handler's operations, one method per op it names:
 * `class PostRest extends RestMiddleware(PostHandler) { bySlug(request, next) { … } }`. An op it
 * names nothing for goes straight through.
 */
export function RestMiddleware(handler: HandlerClass): new () => { around(request: RestRequest, next: () => Promise<ResponseResult>): Promise<ResponseResult> };
export function RestMiddleware(handler?: HandlerClass): unknown {
  if (!handler) {
    abstract class AtRest extends DoorMiddleware<RestRequest, ResponseResult> {
      static override readonly door = 'rest';
    }

    return AtRest;
  }

  abstract class AtHandler extends DoorMiddleware<RestRequest, ResponseResult> {
    static override readonly door = 'rest';
    static override readonly handler = handler;

    around(request: RestRequest, next: () => Promise<ResponseResult>): Promise<ResponseResult> {
      const own = (this as unknown as Record<string, unknown>)[request.operation];

      return typeof own === 'function' ? own.call(this, request, next) : next();
    }
  }

  return AtHandler;
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
    address: route.address,
    carries: 'http',
    carrier: ({ headers }): HttpCarrier => ({ request: headers, response: new Headers() }),
    decode: async ({ params, query, body, state }) => ({ params, query, input: await read(body), state }),
    run: (invocation) => route.handler(invocation),
    encode: (outcome, _request, carrier) => leaving(
      'refused' in outcome ? refused(outcome.refused) : responseOf(route, outcome.answered),
      carrier as HttpCarrier | undefined,
    ),
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

/** What the keepers of `state:` wrote on the carrier goes out with the answer — every `Set-Cookie` line kept apart. */
function leaving(answer: ResponseResult, carrier: HttpCarrier | undefined): ResponseResult {
  const cookies = carrier?.response.getSetCookie() ?? [];
  if (cookies.length === 0) return answer;

  return { ...answer, headers: { ...answer.headers, 'set-cookie': cookies } };
}

function notFound(route: RouteDefinition): FougereError {
  return new FougereError({ code: ErrorCode.NOT_FOUND, message: `No row answers ${route.method} ${route.path}.` });
}

function refused(failure: FougereError): ResponseResult {
  const { status, body } = toHttpError(failure);

  return { status, data: body };
}
