import { describe, expect, it, vi } from 'vitest';
import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import type { Handler, HttpMethod, HttpRouter, RequestContext } from '@fougere/http';
import { registerGraphQL } from '../src/index.js';

function fixture() {
  const mutate = vi.fn(() => 'changed');
  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: { hello: { type: GraphQLString, resolve: () => 'world' } },
    }),
    mutation: new GraphQLObjectType({
      name: 'Mutation',
      fields: { change: { type: GraphQLString, resolve: mutate } },
    }),
  });
  const handlers = new Map<string, Handler>();
  const router: HttpRouter = {
    use: vi.fn() as never,
    on(method, path, handler) { handlers.set(`${method} ${path}`, handler); },
  };
  return { schema, mutate, router, handlers };
}

function context(method: HttpMethod, query: Record<string, string> = {}): RequestContext {
  return {
    request: new Request('http://localhost/graphql'),
    method,
    path: '/graphql',
    params: {},
    query,
    body: async () => ({}),
    state: {},
  };
}

describe('registerGraphQL', () => {
  it('executes a query over GET', async () => {
    const { schema, router, handlers } = fixture();
    registerGraphQL(router, schema);

    const response = await handlers.get('GET /graphql')!(context('GET', { query: '{ hello }' }));
    expect(response).toMatchObject({ status: 200, data: { data: { hello: 'world' } } });
  });

  it('refuses a mutation over GET without executing it', async () => {
    const { schema, mutate, router, handlers } = fixture();
    registerGraphQL(router, schema);

    const response = await handlers.get('GET /graphql')!(context('GET', { query: 'mutation { change }' }));
    expect(response.status).toBe(405);
    expect(response.headers).toEqual({ allow: 'POST' });
    expect(mutate).not.toHaveBeenCalled();
  });

  it('keeps the playground opt-in', async () => {
    const first = fixture();
    registerGraphQL(first.router, first.schema);
    expect((await first.handlers.get('GET /graphql')!(context('GET'))).status).toBe(400);

    const second = fixture();
    registerGraphQL(second.router, second.schema, { playground: true });
    expect(await second.handlers.get('GET /graphql')!(context('GET'))).toMatchObject({ status: 200, raw: true });
  });
});
