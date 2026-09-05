import { describe, it, expect, vi } from 'vitest';
import type { HttpRouter, HttpMethod, Handler, RequestContext } from '@fougere/http';
import { Boundaries, number, type Fields } from '@fougere/schema';
import { registerRoutes, type RouteDefinition } from '../src/index.js';

function fakeRouter() {
  const registered: { method: HttpMethod; path: string; handler: Handler }[] = [];
  const router: HttpRouter = {
    use: vi.fn(),
    on(method: HttpMethod, path: string, handler: Handler) {
      registered.push({ method, path, handler });
    },
  };
  return {
    router,
    getHandler(method: HttpMethod, path: string) {
      return registered.find((r) => r.method === method && r.path === path)?.handler;
    },
  };
}

// Typed as the real `RequestContext`, so this stand-in cannot quietly drift from it.
// `request` was missing: the handlers under test don't read it, but a context without
// it is not the thing the router hands them.
function ctx(params = {}, query = {}, body = {}, method: HttpMethod = 'GET'): RequestContext {
  return {
    request: new Request('http://localhost/'),
    method,
    path: '/',
    params: params as Record<string, string>,
    query: query as Record<string, string>,
    body: async () => body,
    state: {},
  };
}

describe('registerRoutes', () => {
  it('registers routes with correct HTTP methods', () => {
    const { router, getHandler } = fakeRouter();
    const routes: RouteDefinition[] = [
      { method: 'GET', path: '/posts', operationName: 'list', entityName: 'post', handler: async () => [] },
      { method: 'POST', path: '/posts', operationName: 'create', entityName: 'post', handler: async () => ({}) },
      { method: 'PUT', path: '/posts/:id', operationName: 'update', entityName: 'post', handler: async () => ({}) },
      { method: 'DELETE', path: '/posts/:id', operationName: 'delete', entityName: 'post', handler: async () => true },
    ];

    registerRoutes(router, routes);

    expect(getHandler('GET', '/posts')).toBeDefined();
    expect(getHandler('POST', '/posts')).toBeDefined();
    expect(getHandler('PUT', '/posts/:id')).toBeDefined();
    expect(getHandler('DELETE', '/posts/:id')).toBeDefined();
  });

  it('builds InvocationContext and forwards to route handler', async () => {
    const { router, getHandler } = fakeRouter();
    const handlerFn = vi.fn(async (inv: any) => ({ id: inv.params.id, title: inv.input.title }));
    const routes: RouteDefinition[] = [
      { method: 'PUT', path: '/posts/:id', operationName: 'update', entityName: 'post', handler: handlerFn },
    ];

    registerRoutes(router, routes);

    const handler = getHandler('PUT', '/posts/:id')!;
    const result = await handler(ctx({ id: 'abc' }, {}, { title: 'Updated' }, 'PUT'));

    expect(handlerFn).toHaveBeenCalledWith({
      params: { id: 'abc' },
      query: {},
      input: { title: 'Updated' },
      state: {},
    });
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ id: 'abc', title: 'Updated' });
  });

  it('returns 201 for POST', async () => {
    const { router, getHandler } = fakeRouter();
    const routes: RouteDefinition[] = [
      { method: 'POST', path: '/posts', operationName: 'create', entityName: 'post', handler: async () => ({ id: '1' }) },
    ];

    registerRoutes(router, routes);

    const handler = getHandler('POST', '/posts')!;
    const result = await handler(ctx({}, {}, {}, 'POST'));

    expect(result.status).toBe(201);
  });

  it('returns 200 for a custom POST command unless a status is stated', async () => {
    const { router, getHandler } = fakeRouter();
    registerRoutes(router, [
      { method: 'POST', path: '/posts/:id/publish', operationName: 'publish', entityName: 'post', handler: async () => ({ id: '1' }) },
    ]);

    expect((await getHandler('POST', '/posts/:id/publish')!(ctx({}, {}, {}, 'POST'))).status).toBe(200);
  });

  it('honors an explicit success status', async () => {
    const { router, getHandler } = fakeRouter();
    registerRoutes(router, [
      { method: 'POST', path: '/jobs', operationName: 'enqueue', entityName: 'job', successStatus: 202, handler: async () => ({ id: '1' }) },
    ]);

    expect((await getHandler('POST', '/jobs')!(ctx({}, {}, {}, 'POST'))).status).toBe(202);
  });

  it('returns 204 for delete (true)', async () => {
    const { router, getHandler } = fakeRouter();
    const routes: RouteDefinition[] = [
      { method: 'DELETE', path: '/posts/:id', operationName: 'delete', entityName: 'post', handler: async () => true },
    ];

    registerRoutes(router, routes);

    const handler = getHandler('DELETE', '/posts/:id')!;
    const result = await handler(ctx({ id: '1' }, {}, {}, 'DELETE'));

    expect(result.status).toBe(204);
  });

  it('returns 404 when handler returns undefined', async () => {
    const { router, getHandler } = fakeRouter();
    const routes: RouteDefinition[] = [
      { method: 'GET', path: '/posts/:id', operationName: 'findById', entityName: 'post', handler: async () => undefined },
    ];

    registerRoutes(router, routes);

    const handler = getHandler('GET', '/posts/:id')!;
    const result = await handler(ctx({ id: 'nope' }));

    expect(result.status).toBe(404);
  });

  it('keeps nullable and boolean custom results as data', async () => {
    const { router, getHandler } = fakeRouter();
    registerRoutes(router, [
      { method: 'GET', path: '/posts/maybe', operationName: 'maybe', entityName: 'post', handler: async () => null },
      { method: 'GET', path: '/posts/exists', operationName: 'exists', entityName: 'post', handler: async () => false },
    ]);

    await expect(getHandler('GET', '/posts/maybe')!(ctx())).resolves.toEqual({ status: 200, data: null });
    await expect(getHandler('GET', '/posts/exists')!(ctx())).resolves.toEqual({ status: 200, data: false });
  });

  it('does not encode a facade result a second time', async () => {
    Boundaries.encoders.register('rest-test-increment', (value) => typeof value === 'number' ? value + 1 : value);
    Boundaries.aliases.register('rest-test-increment', { out: { encode: 'rest-test-increment' } });
    const outputFields: Fields = {
      value: number().with({ boundary: 'rest-test-increment' }),
    };
    const { router, getHandler } = fakeRouter();
    registerRoutes(router, [
      { method: 'GET', path: '/values', operationName: 'list', entityName: 'value', outputFields, handler: async () => ({ value: 11 }) },
    ]);

    expect((await getHandler('GET', '/values')!(ctx())).data).toEqual({ value: 11 });
  });

  it('returns 500 on error', async () => {
    const { router, getHandler } = fakeRouter();
    const routes: RouteDefinition[] = [
      { method: 'GET', path: '/posts', operationName: 'list', entityName: 'post', handler: async () => { throw new Error('boom'); } },
    ];

    registerRoutes(router, routes);

    const handler = getHandler('GET', '/posts')!;
    const result = await handler(ctx());

    expect(result.status).toBe(500);
    expect(result.data).toEqual({ code: 'INTERNAL_ERROR', message: 'Internal error' });
  });
});
