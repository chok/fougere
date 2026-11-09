/**
 * Where rows live is `sources:`'s alone: a frond served by another process keeps its rows in the
 * source `sources:` gives them, and the migration and the guard read the same foreign key there.
 */
import { describe, it, expect, vi } from 'vitest';
import { createContainer } from '@fougere/container';
import { entity, primary, ref, text } from '@fougere/schema';
import { createApp, frond, Repository, type App } from '@fougere/core';
import { createSqliteSource } from '@fougere/adapter-sql';
import { layerOf, storageFrom } from '../src/storage/ResolvedStorage.js';

class User extends entity({ id: primary(text()) }) {}
class Order extends entity({ id: primary(text()), buyerId: ref(User) }) {}
class UserHandler extends Repository<User> {}
class OrderHandler extends Repository<Order> {}

async function booting(rows?: string[]): Promise<{ app: App; pending: readonly string[]; sql: string; asked: unknown[] }> {
  const source = createSqliteSource({ path: ':memory:' });
  const storage = storageFrom({ main: { source, ...(rows && { rows }) } });
  const asked: unknown[] = [];
  const spies = (['debug', 'info', 'log', 'warn'] as const).map((method) => vi.spyOn(console, method).mockImplementation(() => undefined));
  const app = await createApp({
    ...layerOf(storage),
    createContainer,
    fronds: [
      frond('people', { entities: [User], handlers: [{ ctor: UserHandler, repository: User }] }),
      frond('shop', { entities: [Order], handlers: [{ ctor: OrderHandler, repository: Order }] }),
    ],
    remotes: { people: 'http://127.0.0.1:1' },
    remoteTransport: () => async (_call, invocation) => {
      asked.push(invocation.params);

      return { missing: (invocation.params as { keys?: unknown[] }).keys ?? [] };
    },
    extensions: [{ name: 'schema' }],
  });
  for (const spy of spies) spy.mockRestore();
  const pending = await storage.pending!(app);
  await storage.migrate!(app);
  const sql = (source.sqlite.prepare("select group_concat(sql, ' ') as sql from sqlite_master where type = 'table'").get() as { sql: string }).sql;

  return { app, pending, sql, asked };
}

describe('a frond another process serves', () => {
  it('keeps its rows in the default source, and the key holds the reference there', async () => {
    const { app, pending, sql, asked } = await booting();

    expect([...pending].sort()).toEqual(['orders — no table', 'users — no table']);
    expect(sql).toMatch(/references "users"/i);
    await expect(app.storageFor('order')!.create({ id: 'o', buyerId: 'absent' })).rejects.toThrow(/FOREIGN KEY/);
    expect(asked).toEqual([]);
    await app.dispose();
  });

  it('is asked across when `sources:` puts its rows in none of this process\'s sources', async () => {
    const { app, pending, sql, asked } = await booting(['Order']);

    expect([...pending].sort()).toEqual(['main: fougere_targets — no table', 'main: orders — no table']);
    expect(sql).not.toMatch(/references/i);
    await expect(app.storageFor('order')!.create({ id: 'o', buyerId: 'absent' })).rejects.toThrow();
    expect(asked.length).toBeGreaterThan(0);
    await app.dispose();
  });
});
