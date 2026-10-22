/**
 * The caller's state kept in a session: the caller holds one cookie with a reference, and every name
 * `state:` keeps in `session` lives in one row. The op is the one a cookie-kept state is written with.
 */
import '@fougere/state-session';
import { describe, expect, it } from 'vitest';
import { configureFougere, serveRest, useFougereApp } from '@fougere/app';
import { frond, type State } from '@fougere/core';

process.env.FOUGERE_STATE_KEY = 'a key for the test, long enough to sign with';

class CartHandler {
  async open(state: State) { state.set('cart', 'c42'); state.set('draft', 'd1'); state.set('locale', 'fr'); return { opened: true }; }
  async current(state: State) { return { cart: state.get('cart') ?? null, draft: state.get('draft') ?? null, locale: state.get('locale') ?? null }; }
  async close(state: State) { state.delete('cart'); state.delete('draft'); return { closed: true }; }
}

configureFougere({
  migrates: true,
  config: {
    protocols: { rest: {} },
    state: { cart: { session: {} }, draft: { session: {} }, locale: { cookie: {} } },
  },
  fronds: [frond('shop', {
    handlers: [{ ctor: CartHandler, operations: {
      open: { params: { state: 'State' } },
      current: { params: { state: 'State' } },
      close: { params: { state: 'State' } },
    } }],
  })],
});
const app = await useFougereApp();

const call = async (path: string, cookies: string[] = []) => {
  const answered = await serveRest(app, {
    method: 'POST', path, query: {}, state: {},
    headers: new Headers(cookies.length > 0 ? { cookie: cookies.join('; ') } : {}),
    body: async () => undefined,
  }) as { body: unknown; headers?: Record<string, string[]> };

  return { body: answered.body, lines: answered.headers?.['set-cookie'] ?? [] };
};
const pairsOf = (lines: string[]) => lines.map((line) => line.split(';')[0]!);

describe('a state kept in a session', () => {
  it('hands the caller one reference for every name it keeps, and reads them back through it', async () => {
    const opened = await call('/api/shop/carts/open');
    const names = pairsOf(opened.lines).map((pair) => pair.split('=')[0]);

    expect(names.sort()).toEqual(['locale', 'session']);
    expect([...await app.storageFor('stateSession')!.list()]).toMatchObject([{ values: { cart: expect.any(String), draft: expect.any(String) } }]);
    expect((await call('/api/shop/carts/current', pairsOf(opened.lines))).body).toEqual({ cart: 'c42', draft: 'd1', locale: 'fr' });
  });

  it('reads a reference nobody handed out as no session', async () => {
    expect((await call('/api/shop/carts/current', ['session=made-up'])).body).toEqual({ cart: null, draft: null, locale: null });
  });

  it('deletes the row and expires the reference once every name is forgotten', async () => {
    const opened = await call('/api/shop/carts/open');
    const reference = pairsOf(opened.lines).find((pair) => pair.startsWith('session='))!;
    const closed = await call('/api/shop/carts/close', [reference]);

    expect(closed.lines).toEqual(['session=; Path=/; SameSite=Lax; HttpOnly; Max-Age=0']);
    expect(await app.storageFor('stateSession')!.findById(reference.split('=')[1]!)).toBeUndefined();
  });
});
