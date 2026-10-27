import { ErrorCode, FougereError, toHttpError, type Door } from '@fougere/core';
import type { HttpCarrier, ResponseResult } from '@fougere/http';
import type { RouteDefinition } from './routes/RouteDefinition.js';
import type { Fields } from '@fougere/schema';

/** What a host hands the REST door for one matched route — the body still to read, so the door reads it. */
export interface RestRequest {
  /** The op the route names — what a link bound to a handler answers by a method of that name. */
  operation: string;
  headers: Headers;
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: () => Promise<unknown>;
  state: Record<string, unknown>;
}

/**
 * An answer a link at REST's door may give in the op's place, declared in its return type — the status
 * and the headers are what the contract reads, in the vocabulary of OpenAPI's `responses`.
 */
export interface RestResponse<Status extends number, Headers extends Record<string, string> = Record<never, string>, Body = null>
  extends ResponseResult {
  status: Status;
  headers: Headers;
  data: Body;
}

/**
 * What stands at REST's door, the port its links stand in front of. `implements Partial<Rest>`, asking
 * for `inner: Rest`, stands around every route of its frond; `extends Rest<NoteHandler>`, handing its
 * `inner` to `super`, stands around that handler's routes alone, one method per op it names — an op it
 * names nothing for goes straight through. Two are ordered by `ports: { Rest: [...] }`.
 *
 * Throwing before `inner.answer` refuses the request, which the door says in its own shape — before
 * the body is read, since the door reads it inside.
 *
 * Documented: [surfaces](https://fougere.dev/docs/infra/surfaces).
 */
export abstract class Rest<H = never> {
  declare private readonly standsAt?: H;

  constructor(protected readonly inner?: Rest<H>) {}

  /** The request, answered by the method named after its op when there is one, by what comes next otherwise. */
  answer(request: RestRequest): Promise<ResponseResult> {
    const own = (this as unknown as Record<string, unknown>)[request.operation];
    if (typeof own === 'function') return own.call(this, request) as Promise<ResponseResult>;
    if (!this.inner) throw new Error(`${this.constructor.name} extends Rest and handed no inner to super: write super(inner).`);

    return this.inner.answer(request);
  }
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
    // A read carries no body, so what its input view names arrives in the query string.
    decode: async ({ params, query, body, state }) => ({
      params,
      query,
      input: route.method === 'GET' && route.inputFields ? inputOf(route.inputFields, query) : await body(),
      state,
    }),
    run: (invocation) => route.handler(invocation),
    encode: (outcome, _request, carrier) => leaving(
      'refused' in outcome ? refused(outcome.refused) : responseOf(route, outcome.answered),
      carrier as HttpCarrier | undefined,
    ),
  };
}

/** The fields of an input view the query string carries, read as the shape of each says — a query holds only text. */
function inputOf(fields: Fields, query: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).flatMap(([key, field]): [string, unknown][] => {
    if (query[key] === undefined) return [];
    const text = String(query[key]);
    const type = (field.shape as { type?: unknown }).type;
    if (type === 'number' || type === 'integer') return [[key, text.trim() === '' ? text : Number(text)]];
    if (type === 'boolean') return [[key, text === 'true' ? true : text === 'false' ? false : text]];

    return [[key, text]];
  }));
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
