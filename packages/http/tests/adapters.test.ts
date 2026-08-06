import { describe, expect, it, vi } from 'vitest';
import { createFastifyRouter, createHonoRouter } from '../src/index.js';

describe('Hono adapter', () => {
  it('turns malformed JSON into a 400 response', async () => {
    let registered: Function | undefined;
    const app = {
      use: vi.fn(), get: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
      post: vi.fn((_path: string, handler: Function) => { registered = handler; }),
    };
    const router = createHonoRouter(app);
    router.on('POST', '/items', async (ctx) => {
      await ctx.body();
      return { status: 200, data: {} };
    });

    const state = new Map<string, unknown>();
    const context = {
      req: {
        raw: new Request('http://localhost/items', { method: 'POST' }),
        method: 'POST', path: '/items',
        param: () => ({}), query: () => ({}),
        header: () => 'application/json',
        json: async () => { throw new SyntaxError('bad json'); },
      },
      get: (key: string) => state.get(key),
      set: (key: string, value: unknown) => state.set(key, value),
      header: vi.fn(), body: vi.fn(),
      json: vi.fn((data: unknown, status: number) => ({ data, status })),
    };

    await expect(registered!(context)).resolves.toEqual({
      status: 400,
      data: { code: 'BAD_REQUEST', message: 'Malformed JSON body' },
    });
  });

  it('turns malformed JSON read by middleware into a 400 response', async () => {
    let registered: Function | undefined;
    const app = {
      use: vi.fn((handler: Function) => { registered = handler; }),
      get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
    };
    const router = createHonoRouter(app);
    router.use(async (ctx, next) => {
      await ctx.body();
      return next();
    });

    const state = new Map<string, unknown>();
    const context = {
      req: {
        raw: new Request('http://localhost/items', { method: 'POST' }),
        method: 'POST', path: '/items',
        param: () => ({}), query: () => ({}),
        header: () => 'application/json',
        json: async () => { throw new SyntaxError('bad json'); },
      },
      res: { status: 200 },
      get: (key: string) => state.get(key),
      set: (key: string, value: unknown) => state.set(key, value),
      header: vi.fn(), body: vi.fn(),
      json: vi.fn((data: unknown, status: number) => ({ data, status })),
    };

    await expect(registered!(context, vi.fn())).resolves.toEqual({
      status: 400,
      data: { code: 'BAD_REQUEST', message: 'Malformed JSON body' },
    });
  });
});

describe('Fastify adapter', () => {
  it('preserves the content type of a raw response', async () => {
    let registered: Function | undefined;
    const server = {
      addHook: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
      get: vi.fn((_path: string, handler: Function) => { registered = handler; }),
    };
    const router = createFastifyRouter(server);
    router.on('GET', '/feed', async () => ({
      status: 200,
      data: '<feed/>',
      raw: true,
      headers: { 'content-type': 'application/xml' },
    }));

    const reply = {
      header: vi.fn(),
      type: vi.fn(),
      status: vi.fn(function () { return this; }),
      send: vi.fn(function () { return this; }),
    };
    await registered!({ method: 'GET', protocol: 'http', hostname: 'localhost', url: '/feed', headers: {} }, reply);

    expect(reply.header).toHaveBeenCalledWith('content-type', 'application/xml');
    expect(reply.type).not.toHaveBeenCalled();
    expect(reply.send).toHaveBeenCalledWith('<feed/>');
  });
});
