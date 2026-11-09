import { ErrorCode, FougereError, toHttpError, type Door } from '@fougere/core';
import type { HttpCarrier, ResponseResult } from '@fougere/http';
import type { RestInvocation } from './RestInvocation.js';
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
 * The port REST's links stand in front of; a link throwing before `inner.answer` refuses the request.
 * Ex: `implements Partial<Rest>` for a frond, `extends Rest<NoteHandler>` for a handler.
 *
 * Documented: [surfaces](https://fougere.dev/docs/serve/rest-graphql).
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

/** REST's door for one route: the one place a status is decided, read off the contract. */
export function restDoor(route: RouteDefinition): Door<RestRequest, RestInvocation, ResponseResult> {
  return {
    name: 'rest',
    address: route.address,
    carries: 'http',
    carrier: ({ headers }): HttpCarrier => ({ request: headers, response: new Headers() }),
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
    const page = result as unknown as { total?: number; hasMore?: boolean; endCursor?: string };

    return { status, data: { items: [...result], total: page.total, hasMore: page.hasMore, endCursor: page.endCursor } };
  }

  return { status, data: result };
}

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
