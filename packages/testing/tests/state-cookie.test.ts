/**
 * The caller's state kept in a cookie, through REST: an op writes a name, the answer sets a signed
 * cookie, the next request sends it back and the op reads the value — a changed cookie reads as
 * absent. Core signs; `@fougere/state-cookie` writes the line; the door carries it.
 */
import '@fougere/state-cookie';
import { describe, expect, it } from 'vitest';
import { configureFougere, serveRest, serveRpc, useFougereApp } from '@fougere/app';
import { frond, type State } from '@fougere/core';

process.env.FOUGERE_STATE_KEY = 'a key for the test, long enough to sign with';

class CartHandler {
  async open(state: State) { state.set('cart', 'c42'); return { opened: true }; }
  async current(state: State) { return { cart: state.get('cart') ?? null }; }
}

configureFougere({
  migrates: true,
  config: { protocols: { rest: {} }, state: { cart: { cookie: { maxAge: 3600 } } } },
  fronds: [frond('shop', {
    handlers: [{ ctor: CartHandler, operations: {
      open: { params: { state: 'State' } },
      current: { params: { state: 'State' } },
    } }],
  })],
});
const app = await useFougereApp();

const call = (path: string, cookie?: string) => serveRest(app, {
  method: 'POST', path, query: {}, state: {},
  headers: new Headers(cookie ? { cookie } : {}),
  body: async () => undefined,
});

describe('a state kept in a cookie', () => {
  it('leaves signed with the answer, and comes back as the value it was', async () => {
    const opened = await call('/api/shop/carts/open');
    const line = (opened as { headers: Record<string, string[]> }).headers['set-cookie']![0]!;

    expect(line).toMatch(/^cart=[\w-]+\.[\w-]+; Path=\/; SameSite=Lax; HttpOnly; Max-Age=3600$/);
    expect(await call('/api/shop/carts/current', line.split(';')[0])).toMatchObject({ body: { cart: 'c42' } });
  });

  it('reads a cookie the caller changed as absent', async () => {
    const opened = await call('/api/shop/carts/open');
    const [, signature] = (opened as { headers: Record<string, string[]> }).headers['set-cookie']![0]!.split(';')[0]!.split('=')[1]!.split('.');
    const forged = `cart=${Buffer.from(JSON.stringify('c99')).toString('base64url')}.${signature}`;

    expect(await call('/api/shop/carts/current', forged)).toMatchObject({ body: { cart: null } });
  });

  it('travels the same through the envelope a page calls, where the host writes the line', async () => {
    const page = async (method: string, cookie?: string) => {
      const response = new Headers();
      const answered = await serveRpc(app, {
        path: '/_fougere/call',
        body: { jsonrpc: '2.0', id: 1, method, params: {} },
        state: {},
        carrier: { request: new Headers(cookie ? { cookie } : {}), response },
      });

      return { answered, cookies: response.getSetCookie() };
    };

    const opened = await page('cart.open');
    expect(opened.cookies).toHaveLength(1);
    expect((await page('cart.current', opened.cookies[0]!.split(';')[0])).answered).toMatchObject({ result: { cart: 'c42' } });
  });
});
