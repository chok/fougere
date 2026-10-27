/**
 * The facades' decisions, pinned once for every host.
 *
 * These used to be spread across two h3 handlers; a second adapter would have made
 * them a third copy, and the copies in this repo have a history of drifting apart.
 * What is tested here is what Nuxt and Next both do WITHOUT restating it: the
 * audience a path selects, what "not ours" looks like, and which verbs a path accepts.
 * What an op's return becomes on the wire is `answer`'s, in `adapter-rest`.
 */
import '@fougere/adapter-graphql';
import { describe, it, expect } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { answerAt } from '@fougere/core';
import { answer, surfaceOf } from '../src/web.js';

class Post extends entity({ id: primary(), title: text() }) {}

const facade = {
  list: () => [],
  findById: () => null,
  create: () => ({}),
  update: () => ({}),
  delete: () => true,
};

/** What `Crud` declares for the three ops acting on one row — the path reads it. */
const byId = [{ name: 'id', source: { kind: 'param', name: 'id', identifies: 'Post' }, optional: false }];
const bindings: Record<string, unknown> = { findById: byId, update: byId, delete: byId };

function appOf(protocols: Record<string, object> = { rest: {} }) {
  return {
    protocols,
    fronds: [{
      name: 'blog',
      entities: [{ name: 'post', entityClass: Post }],
      handlers: [{ address: 'post', operations: new Map(), surface: undefined }],
      presenters: [],
    }],
    resolve: () => undefined as never,
    answer: answerAt,
    listens: () => false,
    facadeFor: (name: string) => (name === 'post' ? facade : undefined),
    operationsFor: (name: string) => (name === 'post'
      ? new Map(Object.keys(facade).map((op) => [
        op,
        { kind: op === 'list' || op === 'findById' ? 'query' : 'command', binding: bindings[op] },
      ]))
      : undefined),
  } as never;
}

const app = appOf();
const asked = (method: string, path: string) => new Request(`http://localhost${path}`, { method });
const request = (method: string, path: string) => answer(app, asked(method, `/api/${path}`), { state: {} });
const graphqlOf = (protocols: Record<string, object>, document?: object) => answer(appOf(protocols), new Request('http://localhost/graphql', {
  method: 'POST',
  ...(document && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(document) }),
}), { state: {} });

describe('surfaceOf', () => {
  it('names no audience on the bare facade', () => {
    expect(surfaceOf('/_fougere/call')).toBeUndefined();
  });

  it('takes the audience from the segment after the facade', () => {
    expect(surfaceOf('/_fougere/call/public')).toBe('public');
  });

  it('ignores a query string — the audience is a path segment, not a parameter', () => {
    expect(surfaceOf('/_fougere/call/public?trace=1')).toBe('public');
  });
});

describe('the app decides which protocols it serves', () => {
  it('serves nothing when the app names no protocol — the route file is not the decision', async () => {
    const closed = appOf({});
    expect(await answer(closed, asked('GET', '/api/blog/posts'), { state: {} })).toBeUndefined();
  });

  it('serves nothing when it declares another adapter but not rest', async () => {
    const closed = appOf({ graphql: {} });
    expect(await answer(closed, asked('GET', '/api/blog/posts'), { state: {} })).toBeUndefined();
  });

  it('declines rather than refuses, so the host keeps routing the request', async () => {
    // `undefined`, never a 404: the app that mounted the facade may serve `/api/...` itself,
    // and an undeclared adapter must not take that path away from it.
    expect(await answer(appOf({}), asked('DELETE', '/api/blog/posts'), { state: {} })).toBeUndefined();
  });

  it('consults the table once declared — the same request, a different answer', async () => {
    // Undeclared: the facade never looks. Declared: it looks, and refuses the verb.
    expect(await answer(appOf({}), asked('DELETE', '/api/blog/posts'), { state: {} })).toBeUndefined();
    expect((await answer(appOf(), asked('DELETE', '/api/blog/posts'), { state: {} }))?.status).toBe(405);
  });
});

describe('REST — what it declines', () => {
  it('passes on a path too short to name an entity, so the app keeps its own /api routes', async () => {
    expect(await request('GET', 'health')).toBeUndefined();
  });

  it('passes on a path no frond serves', async () => {
    expect(await request('GET', 'blog/nope')).toBeUndefined();
  });

  it('refuses a verb the table does not serve, and says which ones it does', async () => {
    const refused = (await request('DELETE', 'blog/posts'))!;

    expect(refused.status).toBe(405);
    expect(refused.headers.get('allow')).toBe('GET, POST');
    expect(await refused.json()).toMatchObject({ allow: ['GET', 'POST'] });
  });
});

describe('the GraphQL facade obeys the same declaration', () => {
  it('serves nothing when the app declares no graphql adapter', async () => {
    expect(await graphqlOf({ rest: {} }, { query: '{ __typename }' })).toBeUndefined();
  });

  it('refuses a request with no query once declared', async () => {
    expect((await graphqlOf({ graphql: {} }))?.status).toBe(400);
  });

  it('checks the declaration before the query — an undeclared adapter says nothing at all', async () => {
    // No query AND no adapter: the answer is `undefined`, not a 400. A facade that is not
    // served does not get to complain about what was sent to it.
    expect(await graphqlOf({})).toBeUndefined();
  });
});

describe('the call envelope a page knocks on', () => {
  it('refuses `args` — a page sends a request, and a peer hands over the arguments', async () => {
    const answered = await answer(app, new Request('http://localhost/_fougere/call', {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'post.update', params: { args: ['1', { title: 'x' }, { id: 'admin' }] } }),
    }), { state: {} });
    const body = await answered!.json() as { error: { data: { code: string; message: string } } };

    expect(body.error.data).toMatchObject({ code: 'BAD_REQUEST', message: expect.stringMatching(/not `args` \(only fronds send `args`\)/) });
  });
});

describe('the audience a GraphQL path selects', () => {
  it('is the one segment after where GraphQL is mounted, on every host', async () => {
    const { graphqlSurfaceOf } = await import('../src/graphql.js');

    expect(graphqlSurfaceOf('/graphql')).toBeUndefined();
    expect(graphqlSurfaceOf('/graphql/public')).toBe('public');
    expect(graphqlSurfaceOf('/graphql/public?x=1')).toBe('public');
    expect(graphqlSurfaceOf('/api/graphql/admin', '/api/graphql')).toBe('admin');
    expect(graphqlSurfaceOf('/graphqlx/public')).toBeUndefined();
    expect(graphqlSurfaceOf('/graphql/a/b')).toBeUndefined();
  });
});
