/**
 * The Express adapter is the only one that is not handed a Web `Request`, so it is
 * the only one that has to build one — and the only one that must work whether or
 * not the host app mounted `express.json()`. Both halves are pinned here, with a
 * fake app: the adapter's contract is with Express's SHAPE, not with its code.
 */
import { describe, expect, it, vi } from 'vitest';
import { createExpressRouter } from '../src/index.js';
import type { RequestContext } from '../src/router.js';

/** A fake Express app that hands back whatever handler was registered. */
function fakeApp() {
  const routes = new Map<string, Function>();
  const app = {
    use: vi.fn(),
    get: vi.fn((path: string, handler: Function) => routes.set(`GET ${path}`, handler)),
    post: vi.fn((path: string, handler: Function) => routes.set(`POST ${path}`, handler)),
    put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
  };
  return { app, handlerFor: (key: string) => routes.get(key)! };
}

/** A fake response that records what the adapter wrote. */
function fakeRes() {
  const sent: { status?: number; json?: unknown; raw?: unknown; headers: Record<string, unknown> } = { headers: {} };
  const res = {
    status: vi.fn((code: number) => { sent.status = code; return res; }),
    set: vi.fn((key: string, value: unknown) => { sent.headers[key] = value; return res; }),
    json: vi.fn((data: unknown) => { sent.json = data; return res; }),
    send: vi.fn((data: unknown) => { sent.raw = data; return res; }),
  };
  return { res, sent };
}

/** A Node request whose body was never parsed — the stream is ours to drain. */
function streamingReq(body: string, overrides: Record<string, unknown> = {}) {
  return {
    method: 'POST',
    url: '/items',
    originalUrl: '/items',
    path: '/items',
    headers: { host: 'localhost', 'content-type': 'application/json' },
    params: {},
    query: {},
    on(event: string, cb: (arg?: unknown) => void) {
      if (event === 'data') cb(Buffer.from(body));
      if (event === 'end') cb();
    },
    ...overrides,
  };
}

describe('Express adapter — the body nobody parsed', () => {
  it('drains the stream when no body parser ran', async () => {
    const { app, handlerFor } = fakeApp();
    const router = createExpressRouter(app);
    let seen: unknown;
    router.on('POST', '/items', async (ctx) => {
      seen = await ctx.body();
      return { status: 200, data: { ok: true } };
    });

    const { res, sent } = fakeRes();
    await handlerFor('POST /items')(streamingReq('{"title":"x"}'), res, vi.fn());

    expect(seen).toEqual({ title: 'x' });
    expect(sent.status).toBe(200);
  });

  it('trusts express.json() when it already ran, stream or no stream', async () => {
    const { app, handlerFor } = fakeApp();
    const router = createExpressRouter(app);
    let seen: unknown;
    router.on('POST', '/items', async (ctx) => {
      seen = await ctx.body();
      return { status: 200, data: {} };
    });

    const req = streamingReq('ignored', { body: { title: 'parsed by express' } });
    await handlerFor('POST /items')(req, fakeRes().res, vi.fn());
    expect(seen).toEqual({ title: 'parsed by express' });
  });

  it('parses once however many readers ask — a drained stream answers empty twice', async () => {
    const { app, handlerFor } = fakeApp();
    const router = createExpressRouter(app);
    const reads: unknown[] = [];
    router.use(async (ctx: RequestContext, next) => {
      reads.push(await ctx.body());
      return next();
    });
    router.on('POST', '/items', async (ctx) => {
      reads.push(await ctx.body());
      return { status: 200, data: {} };
    });

    await handlerFor('POST /items')(streamingReq('{"n":1}'), fakeRes().res, vi.fn());
    expect(reads).toEqual([{ n: 1 }, { n: 1 }]);
  });

  it('answers 400 on malformed JSON rather than handing Express an exception', async () => {
    const { app, handlerFor } = fakeApp();
    const router = createExpressRouter(app);
    router.on('POST', '/items', async (ctx) => {
      await ctx.body();
      return { status: 200, data: {} };
    });

    const { res, sent } = fakeRes();
    const next = vi.fn();
    await handlerFor('POST /items')(streamingReq('{ not json'), res, next);

    expect(sent.status).toBe(400);
    expect(sent.json).toEqual({ code: 'BAD_REQUEST', message: 'Malformed JSON body' });
    expect(next).not.toHaveBeenCalled();
  });

  it('reads no body on GET, and does not wait on a stream that will not end', async () => {
    const { app, handlerFor } = fakeApp();
    const router = createExpressRouter(app);
    let seen: unknown;
    router.on('GET', '/items', async (ctx) => {
      seen = await ctx.body();
      return { status: 200, data: {} };
    });

    const req = { ...streamingReq(''), method: 'GET', on: () => { throw new Error('must not drain'); } };
    await handlerFor('GET /items')(req, fakeRes().res, vi.fn());
    expect(seen).toEqual({});
  });
});

describe('Express adapter — the Request it builds', () => {
  it('gives the interface a real Request, absolute URL and headers included', async () => {
    const { app, handlerFor } = fakeApp();
    const router = createExpressRouter(app);
    let ctx: RequestContext | undefined;
    router.on('GET', '/items', async (c) => { ctx = c; return { status: 200, data: {} }; });

    const req = {
      ...streamingReq(''),
      method: 'GET',
      headers: { host: 'example.test', authorization: 'Bearer t' },
      originalUrl: '/items?page=2',
      path: '/items',
      query: { page: '2' },
      params: { id: '7' },
    };
    await handlerFor('GET /items')(req, fakeRes().res, vi.fn());

    expect(ctx!.request).toBeInstanceOf(Request);
    expect(ctx!.request.url).toBe('http://example.test/items?page=2');
    expect(ctx!.request.headers.get('authorization')).toBe('Bearer t');
    expect(ctx!.method).toBe('GET');
    expect(ctx!.path).toBe('/items');
    expect(ctx!.params).toEqual({ id: '7' });
    expect(ctx!.query).toEqual({ page: '2' });
  });

  it('flattens a repeated query parameter to its first value, like the other adapters', async () => {
    const { app, handlerFor } = fakeApp();
    const router = createExpressRouter(app);
    let ctx: RequestContext | undefined;
    router.on('GET', '/items', async (c) => { ctx = c; return { status: 200, data: {} }; });

    const req = { ...streamingReq(''), method: 'GET', query: { tag: ['a', 'b'] } };
    await handlerFor('GET /items')(req, fakeRes().res, vi.fn());
    expect(ctx!.query).toEqual({ tag: 'a' });
  });
});

describe('Express adapter — what it writes back', () => {
  it('sends JSON by default and raw when the producer says so', async () => {
    const { app, handlerFor } = fakeApp();
    const router = createExpressRouter(app);
    router.on('GET', '/items', async () => ({
      status: 201,
      data: '<html/>',
      raw: true,
      headers: { 'content-type': 'text/html' },
    }));

    const { res, sent } = fakeRes();
    await handlerFor('GET /items')({ ...streamingReq(''), method: 'GET' }, res, vi.fn());

    expect(sent.status).toBe(201);
    expect(sent.raw).toBe('<html/>');
    expect(sent.json).toBeUndefined();
    expect(sent.headers['content-type']).toBe('text/html');
  });

  it('hands an unexpected failure to Express rather than crashing the process', async () => {
    const { app, handlerFor } = fakeApp();
    const router = createExpressRouter(app);
    const boom = new Error('handler exploded');
    router.on('GET', '/items', async () => { throw boom; });

    const next = vi.fn();
    await handlerFor('GET /items')({ ...streamingReq(''), method: 'GET' }, fakeRes().res, next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});
