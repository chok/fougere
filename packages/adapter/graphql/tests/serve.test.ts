import { describe, expect, it, vi } from 'vitest';
import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { ErrorCode, FougereError } from '@fougere/core';
import type { Handler, HttpMethod, HttpRouter, RequestContext } from '@fougere/http';
import { registerGraphQL } from '../src/index.js';

function fixture() {
  const mutate = vi.fn(() => 'changed');
  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        hello: { type: GraphQLString, resolve: () => 'world' },
        who: { type: GraphQLString, resolve: (_, __, ctx: { state: { user?: string } }) => ctx.state.user ?? null },
        boom: { type: GraphQLString, resolve: () => { throw new Error('secret at /etc/db.sqlite'); } },
        refused: {
          type: GraphQLString,
          resolve: () => { throw new FougereError({ code: ErrorCode.FORBIDDEN, message: 'Not yours.' }); },
        },
      },
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

function context(method: HttpMethod, query: Record<string, string> = {}, state: Record<string, unknown> = {}): RequestContext {
  return {
    request: new Request('http://localhost/graphql'),
    method,
    path: '/graphql',
    params: {},
    query,
    body: async () => ({}),
    state,
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

  it('hands the resolvers the state the router middlewares wrote', async () => {
    const { schema, router, handlers } = fixture();
    registerGraphQL(router, schema);

    const response = await handlers.get('GET /graphql')!(context('GET', { query: '{ who }' }, { user: 'ada' }));
    expect(response.data).toEqual({ data: { who: 'ada' } });
  });

  it('never hands an accidental error to the caller, and keeps a refusal in its own words', async () => {
    const { schema, router, handlers } = fixture();
    registerGraphQL(router, schema);

    const response = await handlers.get('GET /graphql')!(context('GET', { query: '{ boom refused }' }));
    const errors = (response.data as { errors: { message: string; extensions: Record<string, unknown> }[] }).errors;
    expect(errors.map((error) => error.message)).toEqual(['Internal error', 'Not yours.']);
    expect(errors.map((error) => error.extensions.code)).toEqual([ErrorCode.INTERNAL_ERROR, ErrorCode.FORBIDDEN]);
    expect(JSON.stringify(errors)).not.toContain('/etc/db.sqlite');
  });
});
