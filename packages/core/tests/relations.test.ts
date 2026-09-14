/**
 * Who holds a `ref()`, and what happens where nobody does.
 *
 * A foreign key is a promise ONE database makes. Both sides in one source and it is kept for
 * free; a target in another source gets a column and nothing else, and the guard reads the
 * row itself before the write. What neither can reach is announced instead.
 */
import { describe, it, expect, vi } from 'vitest';
import { createContainer, type Container } from '@fougere/container';
import { entity, primary, ref, text, type SchemaView } from '@fougere/schema';
import { createApp, frond, storageOver, togetherKeyOf, type Storage, type Store } from '../src/index.js';

interface Frame {
  run<R>(block: (entities: Storage[]) => Promise<R>): Promise<R>;
}

class Author extends entity({ id: primary(), name: text() }) {}
class Post extends entity({ id: primary(), title: text(), authorId: ref(Author) }) {}

const store = (): Store => {
  const held = new Map<string, Record<string, unknown>>();

  return {
    get: async (key) => held.get(key),
    has: async (key) => held.has(key),
    set: async (key, values) => { held.set(key, values); },
    delete: async (key) => held.delete(key),
    all: async () => [...held.values()],
    client: held,
  };
};

const oneFrond = () => [frond('blog', { entities: [Post, Author] })];
const twoFronds = () => [frond('blog', { entities: [Post] }), frond('people', { entities: [Author] })];

interface Boot {
  /** The source each entity lives in — `db` when unnamed. */
  sources?: Record<string, string>;
  /** Whether a source keeps relations at all. */
  enforces?: boolean;
  fronds?: ReturnType<typeof frond>[];
  remotes?: Record<string, string>;
}

const booting = async ({ sources = {}, enforces = true, fronds = oneFrond(), remotes }: Boot = {}) => {
  const lines: string[] = [];
  const spies = (['debug', 'info', 'log', 'warn', 'error'] as const)
    .map((method) => vi.spyOn(console, method)
      .mockImplementation((...said: unknown[]) => { lines.push(said.join(' ')); }));

  const stores = new Map<string, Store>();
  const storageFactory = storageOver((_entity: SchemaView, name: string) => {
    const made = stores.get(name) ?? store();
    stores.set(name, made);

    return made;
  });

  const app = await createApp({
    createContainer,
    storageFactory,
    sourceOf: (name) => sources[name] ?? 'db',
    enforces: (_source, constraint) => enforces && constraint === 'relation',
    fronds,
    // Never called: nothing here dispatches to the remote, only the boot reads that it is one.
    ...(remotes ? { remotes, remoteTransport: (() => async () => undefined) as never } : {}),
  });
  for (const spy of spies) spy.mockRestore();

  return {
    app,
    posts: app.storageFor('post') as Storage,
    authors: app.storageFor('author') as Storage,
    warned: lines.filter((line) => line.includes('[relations]')),
    dispose: () => app.dispose(),
  };
};

describe('both sides in one source', () => {
  it('reads nothing — the foreign key already refuses the row', async () => {
    const world = await booting();
    // No author was ever stored, and this storage has no key: the write lands because the
    // guard asked no one. In SQL it is the key that answers.
    await expect(world.posts.create({ id: 'p1', title: 'Hello', authorId: 'nobody' }))
      .resolves.toBeDefined();
    await world.dispose();
  });
});

describe('the target in another source', () => {
  it('refuses a key no row answers, naming the field and the target', async () => {
    const world = await booting({ sources: { author: 'archive' } });

    await expect(world.posts.create({ id: 'p1', title: 'Hello', authorId: 'nobody' }))
      .rejects.toThrow(/authorId "nobody" — no author holds it/);
    await world.dispose();
  });

  it('lets the write through once the row is there', async () => {
    const world = await booting({ sources: { author: 'archive' } });
    await world.authors.create({ id: 'a1', name: 'Alice' });

    await expect(world.posts.create({ id: 'p1', title: 'Hello', authorId: 'a1' }))
      .resolves.toBeDefined();
    await world.dispose();
  });

  it('says nothing about a patch that does not carry the field', async () => {
    const world = await booting({ sources: { author: 'archive' } });
    await world.authors.create({ id: 'a1', name: 'Alice' });
    await world.posts.create({ id: 'p1', title: 'Hello', authorId: 'a1' });

    await expect(world.posts.update('p1', { title: 'Bonjour' })).resolves.toBeDefined();
    await world.dispose();
  });

  it('judges a whole page before its first row lands', async () => {
    const world = await booting({ sources: { author: 'archive' } });
    await world.authors.create({ id: 'a1', name: 'Alice' });

    await expect(world.posts.upsertAll([
      { id: 'p1', title: 'One', authorId: 'a1' },
      { id: 'p2', title: 'Two', authorId: 'nobody' },
    ])).rejects.toThrow(/no author holds it/);
    expect(await world.posts.findById('p1')).toBeUndefined();
    await world.dispose();
  });
});

describe('the target in another frond', () => {
  // A frond's scope sees its parent and never its siblings, so the target has to be reached
  // through the frond that owns it — the case a single-frond test cannot tell apart.
  it('refuses the same key, though its storage is registered by the neighbour', async () => {
    const world = await booting({ sources: { author: 'archive' }, fronds: twoFronds() });

    await expect(world.posts.create({ id: 'p1', title: 'Hello', authorId: 'nobody' }))
      .rejects.toThrow(/authorId "nobody" — no author holds it/);
    await world.authors.create({ id: 'a1', name: 'Alice' });
    await expect(world.posts.create({ id: 'p1', title: 'Hello', authorId: 'a1' }))
      .resolves.toBeDefined();
    await world.dispose();
  });

  it('announces nothing, because something here holds it', async () => {
    const world = await booting({ sources: { author: 'archive' }, fronds: twoFronds() });

    expect(world.warned).toEqual([]);
    await world.dispose();
  });
});

describe('a write inside a frame', () => {
  // A frame rebuilds its members' storages, and a guard built there without the checks
  // would have let through inside `Together<[…]>` what it refuses outside.
  it('meets the same check as the storage it was rebuilt from', async () => {
    const key = togetherKeyOf(['post']);
    class Publishing {}
    const world = await booting({
      sources: { author: 'archive' },
      fronds: [frond('blog', { entities: [Post, Author], handlers: [{ ctor: Publishing, deps: [key] }] })],
    });
    const frame = world.app.container.resolve<Container>('frond:blog').resolve<Frame>(key);

    await expect(frame.run(([posts]) => posts.create({ id: 'p1', title: 'Hello', authorId: 'nobody' })))
      .rejects.toThrow(/no author holds it/);
    await world.dispose();
  });
});

describe('a source that keeps no relation at all', () => {
  it('reads the row itself, because nothing else will', async () => {
    const world = await booting({ enforces: false });

    await expect(world.posts.create({ id: 'p1', title: 'Hello', authorId: 'nobody' }))
      .rejects.toThrow(/no author holds it/);
    await world.dispose();
  });
});

describe('the target behind remotes:', () => {
  it('is announced at boot, naming the field and the target', async () => {
    const world = await booting({ fronds: twoFronds(), remotes: { people: 'http://127.0.0.1:9' } });

    expect(world.warned).toHaveLength(1);
    expect(world.warned[0]).toContain('authorId → author');
    await world.dispose();
  });
});
