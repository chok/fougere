/** `cookie` — a caller's state kept in a cookie, registered at import. */
import { States } from '@fougere/core';
import type { HttpCarrier } from '@fougere/http';
import { Format, type Accepted } from '@fougere/schema';

const COOKIE = Format.of('state/cookie')
  .key('maxAge', Format.count)
  .key('path', Format.text)
  .key('domain', Format.text)
  .key('sameSite', Format.tokens(['lax', 'strict', 'none'] as const))
  .key('secure', Format.flag)
  .key('httpOnly', Format.flag)
  .closed();

export type CookieOptions = Accepted<typeof COOKIE>;

declare module '@fougere/core' {
  interface FougereStates {
    cookie: CookieOptions;
  }
}

function cookiesOf(header: string | null): Map<string, string> {
  return new Map((header ?? '').split(';').flatMap((pair) => {
    const at = pair.indexOf('=');

    return at <= 0 ? [] : [[pair.slice(0, at).trim(), pair.slice(at + 1).trim()] as const];
  }));
}

function lineOf(name: string, token: string | undefined, options: CookieOptions): string {
  const { path = '/', sameSite = 'lax', httpOnly = true, secure, domain, maxAge } = options;

  return [
    `${name}=${token ?? ''}`,
    `Path=${path}`,
    `SameSite=${sameSite[0]!.toUpperCase()}${sameSite.slice(1)}`,
    ...(httpOnly ? ['HttpOnly'] : []),
    ...(secure || sameSite === 'none' ? ['Secure'] : []),
    ...(domain ? [`Domain=${domain}`] : []),
    ...(token === undefined ? ['Max-Age=0'] : maxAge !== undefined ? [`Max-Age=${maxAge}`] : []),
  ].join('; ');
}

States.register('cookie', {
  over: 'http',
  format: COOKIE,
  read: (carrier, names) => {
    const cookies = cookiesOf((carrier as HttpCarrier).request.get('cookie'));

    return new Map(names.flatMap(({ name }) => (cookies.has(name) ? [[name, cookies.get(name)!] as const] : [])));
  },
  write: (carrier, written) => {
    for (const { name, token, options } of written) {
      (carrier as HttpCarrier).response.append('set-cookie', lineOf(name, token, options as CookieOptions));
    }
  },
});
