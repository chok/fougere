/**
 * What the REST door answers, read off the contract — never off the op's name. The two edges that
 * used to decide it apart answered 201 against 200, 204 against 200, and a `remove` returning `false`
 * got 200 where `delete` got 404.
 */
import { describe, it, expect } from 'vitest';
import { answerAt, ErrorCode, FougereError } from '@fougere/core';
import { bool, number, text } from '@fougere/schema';
import { restDoor, type RestRequest, type RouteDefinition } from '../src/index.js';

const request: RestRequest = { operation: 'any', headers: new Headers(), params: {}, query: {}, body: async () => undefined, state: {} };
const answer = (route: RouteDefinition, received: RestRequest) => answerAt(restDoor(route), received);

function route(answered: unknown, shape: Partial<RouteDefinition> = {}): RouteDefinition {
  return {
    method: 'GET', path: '/api/blog/posts', operationName: 'any', address: 'post',
    handler: async () => {
      if (answered instanceof Error) throw answered;

      return answered;
    },
    ...shape,
  };
}

describe('a REST answer', () => {
  it('is 201 for a POST on the collection answering one row, whatever the op is called', async () => {
    expect(await answer(route({ id: 'a' }, { method: 'POST', creates: true }), request)).toEqual({ status: 201, data: { id: 'a' } });
  });

  it('is 204 for an op that answers nothing', async () => {
    expect(await answer(route(undefined, { method: 'POST', cardinality: 'none' }), request)).toEqual({ status: 204, data: null });
  });

  it('is 204 for a DELETE answering true, and 404 for one answering false, under any name', async () => {
    expect(await answer(route(true, { method: 'DELETE', operationName: 'remove' }), request)).toEqual({ status: 204, data: null });
    expect(await answer(route(false, { method: 'DELETE', operationName: 'remove' }), request))
      .toMatchObject({ status: 404, data: { code: 'NOT_FOUND' } });
  });

  it('is 404 for a single row that is not there, and 200 with null where the op promises no row', async () => {
    expect(await answer(route(null, { cardinality: 'maybe' }), request)).toMatchObject({ status: 404, data: { code: 'NOT_FOUND' } });
    expect(await answer(route(null, { cardinality: 'none' }), request)).toEqual({ status: 200, data: null });
  });

  it('writes a page as an envelope, so the page facts survive JSON', async () => {
    const page = Object.assign([{ id: 'a' }, { id: 'b' }], { total: 7, hasMore: true, endCursor: 'b' });

    expect(await answer(route(page, { cardinality: 'page' }), request)).toEqual({
      status: 200,
      data: { items: [{ id: 'a' }, { id: 'b' }], total: 7, hasMore: true, endCursor: 'b' },
    });
    expect(await answer(route([{ id: 'a' }], { cardinality: 'many' }), request)).toEqual({ status: 200, data: [{ id: 'a' }] });
  });

  it('lets protocols.rest.status win over what the contract reads as', async () => {
    expect(await answer(route({ id: 'a' }, { method: 'POST', creates: true, successStatus: 202 }), request)).toEqual({ status: 202, data: { id: 'a' } });
  });

  it('answers a refusal with its status, and an accident as Internal error', async () => {
    const refused = new FougereError({ code: ErrorCode.FORBIDDEN, message: 'Not yours.' });

    expect(await answer(route(refused), request)).toMatchObject({ status: 403, data: { code: 'FORBIDDEN', message: 'Not yours.' } });
    expect(await answer(route(new Error('secret')), request)).toMatchObject({ status: 500, data: { message: 'Internal error' } });
  });

  it('reads the body inside the cycle, and answers a body it refuses with its status', async () => {
    const refusing: RestRequest = { ...request, body: async () => { throw new FougereError({ code: ErrorCode.UNSUPPORTED_MEDIA_TYPE, message: 'Send JSON.' }); } };

    expect(await answer(route({ id: 'a' }, { method: 'POST' }), refusing)).toMatchObject({ status: 415, data: { code: 'UNSUPPORTED_MEDIA_TYPE' } });
  });

  it('reads a GET\'s input off the query string, each field as its shape says', async () => {
    let received: unknown;
    const searched = route(null, {
      inputFields: { title: text(), limit: number({ integer: true }), drafts: bool() },
      handler: async (invocation) => { received = (invocation as { input: unknown }).input; return []; },
    });

    await answer(searched, { ...request, query: { title: 'fern', limit: '5', drafts: 'false', other: 'x' } });

    expect(received).toEqual({ title: 'fern', limit: 5, drafts: false });
  });
});
