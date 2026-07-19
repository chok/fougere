import { describe, it, expect, vi } from 'vitest';
import type { HttpRouter, HttpMethod, Handler } from '@fougere/http';
import { registerRoutes, type RouteDefinition } from '../src/index.js';

function fakeRouter() {
  const registered: Array<{ method: HttpMethod; path: string; handler: Handler }> = [];
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

function ctx(params = {}, query = {}, body = {}, method: HttpMethod = 'GET') {
  return {
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
    const handlerFn = vi.fn(async (inv: any) => ({ id: inv.params.id, title: inv.body.title }));
    const routes: RouteDefinition[] = [
      { method: 'PUT', path: '/posts/:id', operationName: 'update', entityName: 'post', handler: handlerFn },
    ];

    registerRoutes(router, routes);

    const handler = getHandler('PUT', '/posts/:id')!;
    const result = await handler(ctx({ id: 'abc' }, {}, { title: 'Updated' }, 'PUT'));

    expect(handlerFn).toHaveBeenCalledWith({
      params: { id: 'abc' },
      query: {},
      body: { title: 'Updated' },
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

  it('returns 500 on error', async () => {
    const { router, getHandler } = fakeRouter();
    const routes: RouteDefinition[] = [
      { method: 'GET', path: '/posts', operationName: 'list', entityName: 'post', handler: async () => { throw new Error('boom'); } },
    ];

    registerRoutes(router, routes);

    const handler = getHandler('GET', '/posts')!;
    const result = await handler(ctx());

    expect(result.status).toBe(500);
    expect(result.data).toEqual({ code: 'INTERNAL_ERROR', message: 'boom' });
  });
});
