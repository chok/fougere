/**
 * A `ref()` across two sources is arbitrated by a mark the naming source keeps: a write holds it, a
 * release sets it `gone` while it asks, and the mark is taken out once the release ends.
 */
import { describe, it, expect, vi } from 'vitest';
import { createContainer } from '@fougere/container';
import { entity, primary, ref, text } from '@fougere/schema';
import { createApp, frond, Repository, type App } from '@fougere/core';
import { createMemorySource } from '@fougere/adapter-memory';
import { createSqliteSource } from '@fougere/adapter-sql';
import { layerOf, storageFrom } from '../src/storage/ResolvedStorage.js';

class User extends entity({ id: primary(text()) }) {}
class Order extends entity({ id: primary(text()), approverId: ref(User) }) {}
class UserHandler extends Repository<User> {}
class OrderHandler extends Repository<Order> {}

interface World { app: App; people: ReturnType<typeof createSqliteSource>; shop: ReturnType<typeof createSqliteSource> }

async function booting(): Promise<World> {
  const people = createSqliteSource({ path: ':memory:' });
  const shop = createSqliteSource({ path: ':memory:' });
  const storage = storageFrom({ main: { source: people }, shop: { source: shop, rows: ['Order'] } });
  const spies = (['debug', 'info', 'log', 'warn'] as const).map((method) => vi.spyOn(console, method).mockImplementation(() => undefined));
  const app = await createApp({
    ...layerOf(storage),
    createContainer,
    fronds: [
      frond('people', { entities: [User], handlers: [{ ctor: UserHandler, repository: User }] }),
      frond('shop', { entities: [Order], handlers: [{ ctor: OrderHandler, repository: Order }] }),
    ],
    extensions: [{ name: 'schema' }],
  });
  for (const spy of spies) spy.mockRestore();
  await storage.migrate!(app);

  return { app, people, shop };
}

const tables = (source: ReturnType<typeof createSqliteSource>) =>
  (source.sqlite.prepare("select name from sqlite_master where type = 'table' order by name").all() as { name: string }[]).map((row) => row.name);
const marks = (world: World) => world.shop.sqlite.prepare('select id, state from fougere_targets order by id').all();

describe('a reference across two sources', () => {
  it('keeps its marks in the source that names the other', async () => {
    const world = await booting();

    expect(tables(world.shop)).toContain('fougere_targets');
    expect(tables(world.people)).not.toContain('fougere_targets');
    await world.app.dispose();
  });

  it('holds the mark while it writes, and a refused delete leaves it live', async () => {
    const world = await booting();
    await world.app.storageFor('user')!.create({ id: 'u' });
    await world.app.storageFor('order')!.create({ id: 'o', approverId: 'u' });

    expect(marks(world)).toEqual([{ id: 'user#u', state: 'live' }]);
    await expect(world.app.storageFor('user')!.delete('u')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(marks(world)).toEqual([{ id: 'user#u', state: 'live' }]);
    await world.app.dispose();
  });

  it('takes the mark out once the target is gone', async () => {
    const world = await booting();
    await world.app.storageFor('user')!.create({ id: 'u' });
    await world.app.storageFor('order')!.create({ id: 'o', approverId: 'u' });
    await world.app.storageFor('order')!.delete('o');

    expect(await world.app.storageFor('user')!.delete('u')).toBe(true);
    expect(marks(world)).toEqual([]);
    await world.app.dispose();
  });

  it('refuses a write naming a target its release has marked', async () => {
    const world = await booting();
    await world.app.storageFor('user')!.create({ id: 'u' });
    world.shop.sqlite.prepare("insert into fougere_targets (id, state) values ('user#u', 'gone')").run();

    await expect(world.app.storageFor('order')!.create({ id: 'o', approverId: 'u' }))
      .rejects.toMatchObject({ code: 'VALIDATION_FAILED', message: expect.stringContaining('being deleted') });
    expect(world.shop.sqlite.prepare('select count(*) as n from orders').get()).toEqual({ n: 0 });
    await world.app.dispose();
  });
});

describe('two sources with no transaction', () => {
  it('lets one of a write and a delete through, each time', async () => {
    const storage = storageFrom({ main: { source: createMemorySource(), rows: ['User'] }, shop: { source: createMemorySource(), rows: ['Order'] } });
    const spies = (['debug', 'info', 'log', 'warn'] as const).map((method) => vi.spyOn(console, method).mockImplementation(() => undefined));
    const app = await createApp({
      ...layerOf(storage),
      createContainer,
      fronds: [
        frond('people', { entities: [User], handlers: [{ ctor: UserHandler, repository: User }] }),
        frond('shop', { entities: [Order], handlers: [{ ctor: OrderHandler, repository: Order }] }),
      ],
    });
    for (const spy of spies) spy.mockRestore();
    const users = app.storageFor('user')!;
    const orders = app.storageFor('order')!;
    const keys = Array.from({ length: 50 }, (_, round) => `u${round}`);
    for (const key of keys) await users.create({ id: key });

    const both = await Promise.all(keys.map(async (key) => {
      const [created, deleted] = await Promise.allSettled([orders.create({ id: `o-${key}`, approverId: key }), users.delete(key)]);

      return created.status === 'fulfilled' && deleted.status === 'fulfilled' && deleted.value === true;
    }));

    expect(both.filter(Boolean)).toEqual([]);
    await app.dispose();
  });
});
