/** What `cookie` reads off a request and writes on a response, under the names a `Set-Cookie` uses. */
import '../src/index.js';
import { describe, it, expect } from 'vitest';
import { States } from '@fougere/core';

const cookie = States.resolve('cookie');
const carrier = (header?: string) => ({ request: new Headers(header ? { cookie: header } : {}), response: new Headers() });

describe('a cookie-kept state', () => {
  it('reads its name off the Cookie header, among others', () => {
    expect(cookie.read(carrier('theme=dark; cart=c42.sig; x=1'), [{ name: 'cart', options: {} }], () => undefined)).toEqual(new Map([['cart', 'c42.sig']]));
    expect(cookie.read(carrier(), [{ name: 'cart', options: {} }], () => undefined)).toEqual(new Map());
  });

  it('writes a line that a script may not read and another site does not send, by default', () => {
    const on = carrier();
    cookie.write(on, [{ name: 'cart', token: 'c42.sig', options: {} }], () => undefined);

    expect(on.response.getSetCookie()).toEqual(['cart=c42.sig; Path=/; SameSite=Lax; HttpOnly']);
  });

  it('says what the entry says, and SameSite=None is always Secure', () => {
    const on = carrier();
    cookie.write(on, [{ name: 'cart', token: 'c42.sig', options: { maxAge: 3600, sameSite: 'none', httpOnly: false, domain: 'shop.example' } }], () => undefined);

    expect(on.response.getSetCookie()).toEqual(['cart=c42.sig; Path=/; SameSite=None; Secure; Domain=shop.example; Max-Age=3600']);
  });

  it('forgets a name by expiring it', () => {
    const on = carrier();
    cookie.write(on, [{ name: 'cart', token: undefined, options: { maxAge: 3600 } }], () => undefined);

    expect(on.response.getSetCookie()).toEqual(['cart=; Path=/; SameSite=Lax; HttpOnly; Max-Age=0']);
  });
});
