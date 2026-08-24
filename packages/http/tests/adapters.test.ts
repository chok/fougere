import { describe, expect, it, vi } from 'vitest';
import { createFastifyRouter, createHonoRouter, type Middleware } from '../src/index.js';

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

/**
 * The value that separated "the middleware answered" from "the middleware delegated" used
 * to be `null`, which is a legal body: `{ status: 403, data: null }` is how a deny with no
 * body is written. Hono read it as a delegation and ran the route anyway; Fastify sent the
 * 403. Same contract, opposite verdicts — so the two adapters are asked the same question
 * here, and the assertion is that they answer it the same way.
 */
describe('a middleware that refuses with no body', () => {
  const deny: Middleware = async () => ({ status: 403, data: null });

  it('is honoured by Hono, not treated as a passthrough', async () => {
    let middleware: Function | undefined;
    let route: Function | undefined;
    const app = {
      use: vi.fn((handler: Function) => { middleware = handler; }),
      get: vi.fn((_path: string, handler: Function) => { route = handler; }),
      post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
    };
    const router = createHonoRouter(app);
    router.use(deny);
    router.on('GET', '/secret', async () => ({ status: 200, data: { open: true } }));

    const state = new Map<string, unknown>();
    const bodies: unknown[] = [];
    const context = {
      req: {
        raw: new Request('http://localhost/secret'),
        method: 'GET', path: '/secret',
        param: () => ({}), query: () => ({}), header: () => undefined,
      },
      res: { status: 200 },
      get: (key: string) => state.get(key),
      set: (key: string, value: unknown) => state.set(key, value),
      header: vi.fn(),
      body: vi.fn((data: unknown, status: number) => { bodies.push({ data, status }); return { data, status }; }),
      json: vi.fn((data: unknown, status: number) => ({ data, status })),
    };

    // Hono's own `next` — the route runs only if the middleware lets it.
    const next = vi.fn(async () => { await route!(context); });
    await middleware!(context, next);

    expect(next).not.toHaveBeenCalled();
    expect(bodies).toEqual([{ data: null, status: 403 }]);
  });

  it('is honoured by Fastify too, which is what makes the two agree', async () => {
    let registered: Function | undefined;
    const server = {
      addHook: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
      get: vi.fn((_path: string, handler: Function) => { registered = handler; }),
    };
    const router = createFastifyRouter(server);
    router.use(deny);
    router.on('GET', '/secret', async () => ({ status: 200, data: { open: true } }));

    const reply = {
      header: vi.fn(), type: vi.fn(),
      status: vi.fn(function (this: unknown) { return this; }),
      send: vi.fn(function (this: unknown) { return this; }),
    };
    await registered!({ method: 'GET', protocol: 'http', hostname: 'localhost', url: '/secret', headers: {} }, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
  });
});
