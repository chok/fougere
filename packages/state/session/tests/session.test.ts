/** What `session` reads and writes for one request: one reference in a cookie, every name in one row. */
import '../src/index.js';
import { describe, it, expect } from 'vitest';
import { States, type Storage } from '@fougere/core';

const session = States.resolve('session');
const carrier = (header?: string) => ({ request: new Headers(header ? { cookie: header } : {}), response: new Headers() });

/** The three gestures the keeper uses, over a Map. */
function rowsOf(rows = new Map<string, { id: string; values: Record<string, string> }>()) {
  const storage = {
    findById: async (id: string) => rows.get(id),
    upsert: async (row: { id: string; values: Record<string, string> }) => { rows.set(row.id, row); return row; },
    delete: async (id: string) => rows.delete(id),
  } as unknown as Storage;

  return { rows, storageFor: (entity: string) => (entity === 'stateSession' ? storage : undefined) };
}

const names = [{ name: 'cart', options: {} }, { name: 'draft', options: {} }];

describe('a session-kept state', () => {
  it('writes every name into one row, and hands the caller its reference once', async () => {
    const { rows, storageFor } = rowsOf();
    const on = carrier();
    await session.read(on, names, storageFor);
    await session.write(on, [{ name: 'cart', token: 'c.sig', options: {} }, { name: 'draft', token: 'd.sig', options: {} }], storageFor);

    const [reference] = on.response.getSetCookie();
    const id = reference!.split(';')[0]!.split('=')[1]!;
    expect(reference).toMatch(/^session=[\w-]{43}; Path=\/; SameSite=Lax; HttpOnly$/);
    expect(rows.get(id)!.values).toEqual({ cart: 'c.sig', draft: 'd.sig' });
    expect(await session.read(carrier(`session=${id}`), names, storageFor)).toEqual(new Map([['cart', 'c.sig'], ['draft', 'd.sig']]));
  });

  it('keeps the names a request did not write, and sets no reference the caller already holds', async () => {
    const { rows, storageFor } = rowsOf(new Map([['s1', { id: 's1', values: { cart: 'c.sig', draft: 'd.sig' } }]]));
    const on = carrier('session=s1');
    await session.read(on, names, storageFor);
    await session.write(on, [{ name: 'cart', token: undefined, options: {} }], storageFor);

    expect(rows.get('s1')!.values).toEqual({ draft: 'd.sig' });
    expect(on.response.getSetCookie()).toEqual([]);
  });
});
