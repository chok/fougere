/**
 * The doors as Express middlewares.
 *
 * What is pinned is mostly what they DON'T do: a middleware that answers a path it
 * was not asked for is worse than no middleware, because the app it was added to
 * stops working. `next()` is the whole contract, and it is what the earlier
 * `mountDoors` was imitating with a `pass` outcome of its own invention.
 *
 * Nothing imports express — the shapes are structural, so a plain object is a
 * faithful request here.
 */
import { describe, it, expect, vi } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { fougere, fougereCall, fougereRest, fougereSession } from '../src/express.js';
import { configureFougere, useFougereApp } from '../src/boot.js';

class Post extends entity({ id: primary(), title: text() }) {}

/** Boot once and wait for it — the middlewares are lazy, and a 5ms settle is not a boot. */
async function bootWith(rows: { id: string; title: string }[]) {
  configureFougere({
    storage: { storageFactory: () =>
      ({
        list: async () => rows,
        findById: async (id: string) => rows.find((r) => r.id === id),
        findBy: async () => undefined,
        findAllBy: async () => [],
        create: async (input: any) => input,
        update: async (_id: string, input: any) => input,
        delete: async () => true,
        client: {},
        output() { return this; },
      }) as never },
  });
  await useFougereApp();
}

function fakeRes() {
  const sent: { status?: number; body?: unknown; headers: Record<string, unknown> } = { headers: {} };
  const res: any = {
    status: (code: number) => { sent.status = code; return res; },
    set: (k: string, v: unknown) => { sent.headers[k] = v; return res; },
    json: (body: unknown) => { sent.body = body; return res; },
  };
  return { res, sent };
}

/** Run a middleware to completion — they answer asynchronously. */
async function run(mw: ReturnType<typeof fougereCall>, req: any) {
  const { res, sent } = fakeRes();
  const next = vi.fn();
  mw(req, res, next);
  await new Promise((r) => setTimeout(r, 5));
  return { sent, next };
}

describe('what a middleware declines', () => {
  it('passes a path that is not its own', async () => {
    const { next, sent } = await run(fougereCall(), { method: 'POST', path: '/other' });
    expect(next).toHaveBeenCalledOnce();
    expect(sent.status).toBeUndefined();
  });

  it('passes the right path on the wrong verb', async () => {
    const { next } = await run(fougereCall(), { method: 'GET', path: '/_fougere/call' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('passes anything outside the REST mount point', async () => {
    const { next } = await run(fougereRest(), { method: 'GET', path: '/healthz' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('passes /api itself — a mount point is not a resource', async () => {
    const { next } = await run(fougereRest(), { method: 'GET', path: '/api' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('passes a path under /api that no frond serves, so the app keeps its own routes', async () => {
    await bootWith([]);
    const { next, sent } = await run(fougereRest(), { method: 'GET', path: '/api/nope/at/all' });
    expect(next).toHaveBeenCalledOnce();
    expect(sent.status).toBeUndefined();
  });

  it('honours a mount point the app chose', async () => {
    const onAdmin = fougereRest('/admin');
    expect((await run(onAdmin, { method: 'GET', path: '/api/blog/posts' })).next).toHaveBeenCalledOnce();
  });
});

describe('the session door', () => {
  it('answers the view for the state the app resolved', async () => {
    const { sent } = await run(fougereSession(), {
      method: 'GET',
      path: '/_fougere/session',
      user: { id: 'u1', name: 'Ada', passwordHash: 'secret' },
    });

    expect(sent.status).toBe(200);
    expect(sent.body).toEqual({ user: { id: 'u1', name: 'Ada' } });
  });

  it('reads `req.fougereState` when the app fills it', async () => {
    const { sent } = await run(fougereSession(), {
      method: 'GET',
      path: '/_fougere/session',
      fougereState: { user: { id: 'u2' } },
    });
    expect(sent.body).toEqual({ user: { id: 'u2' } });
  });

  it('answers nobody when nothing ran before it', async () => {
    const { sent } = await run(fougereSession(), { method: 'GET', path: '/_fougere/session' });
    expect(sent.body).toEqual({ user: null });
  });

  it('never takes identity from the payload', async () => {
    const { sent } = await run(fougereSession(), {
      method: 'GET',
      path: '/_fougere/session',
      body: { user: { id: 'forged', role: 'admin' } },
    });
    expect(sent.body).toEqual({ user: null });
  });
});

describe('the three composed', () => {
  it('lets each door see the request, and passes when none claims it', async () => {
    await bootWith([]);
    const { next } = await run(fougere(), { method: 'GET', path: '/anything' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('answers the session through the composed middleware', async () => {
    const { sent } = await run(fougere(), { method: 'GET', path: '/_fougere/session' });
    expect(sent.status).toBe(200);
    expect(sent.body).toEqual({ user: null });
  });

  it('lets a synchronous failure reach Express, which owns that contract', () => {
    const { res } = fakeRes();
    // Express wraps a synchronous middleware in its own try/catch and routes the
    // throw to the error handler. Re-implementing that here would be a second answer
    // to a question the host already answers.
    expect(() =>
      fougere()({ method: 'GET', get path(): string { throw new Error('boom'); } } as never, res, vi.fn()),
    ).toThrow('boom');
  });
});
