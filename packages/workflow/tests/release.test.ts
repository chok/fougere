/**
 * A release that goes to the end, even when the process driving it does not.
 *
 * Without this package the hops are the same and in the same order — children before their
 * parent, so an interruption leaves fewer children and never an orphan. What it adds is that
 * somebody finishes: a row says a release began, and a sweep redoes it. Redoing is safe
 * because every hop already is.
 */
import { describe, it, expect, vi } from 'vitest';
import { createContainer } from '@fougere/container';
import { entity, primary, ref, text, type SchemaView } from '@fougere/schema';
import {
  createApp, createLocalRunner, Crud, frond, Invocation, storageOver,
  type App, type Storage, type Store,
} from '@fougere/core';
import { workflow } from '../src/index.js';

class User extends entity({ id: primary(text()), name: text() }) {}
class Post extends entity({ id: primary(text()), title: text(), authorId: ref(User, { onDelete: 'cascade' }) }) {}
class UserHandler extends Crud(User) {}
class PostHandler extends Crud(Post) {}

const store = (): Store => {
  const kept = new Map<string, Record<string, unknown>>();

  return {
    get: async (key) => kept.get(key),
    has: async (key) => kept.has(key),
    set: async (key, values) => { kept.set(key, values); },
    delete: async (key) => kept.delete(key),
    all: async () => [...kept.values()],
    client: kept,
  };
};

/** One set of rows, so a second app picks up exactly what the first left behind. */
const rows = new Map<string, Store>();

interface World { app: App; users: Storage; posts: Storage; runs: Storage }

async function booting(breakAt?: (id: string) => boolean): Promise<World> {
  const spies = (['debug', 'info', 'log', 'warn', 'error'] as const)
    .map((method) => vi.spyOn(console, method).mockImplementation(() => undefined));

  const base = storageOver((_schema: SchemaView, name: string) => {
    const made = rows.get(name) ?? store();
    rows.set(name, made);

    return made;
  });

  const app = await createApp({
    createContainer,
    storageFactory: (schema, name) => {
      const built = base(schema, name) as Storage;
      if (name !== 'post' || !breakAt) return built;

      return Object.assign(Object.create(built), {
        delete: async (id: string) => {
          if (breakAt(id)) throw new Error('the process went away');

          return (built as any).delete(id);
        },
      });
    },
    fronds: [
      frond('people', { entities: [User], handlers: [UserHandler] }),
      frond('blog', { entities: [Post], handlers: [PostHandler] }),
    ],
    // No beat: the test drives the sweep, so nothing races it.
    extensions: [workflow({ sweepMs: 0 })],
  });
  for (const spy of spies) spy.mockRestore();

  const of = (name: string) => app.storageFor(name) as Storage;

  return { app, users: of('user'), posts: of('post'), runs: of('run') };
}

const ids = async (storage: Storage) => (await storage.list()).map((row: any) => row.id).sort();

describe('a release that was interrupted', () => {
  it('leaves a row saying so, and a sweep finishes it', async () => {
    rows.clear();
    const first = await booting((id) => id === 'p2');
    await first.users.create({ id: 'ada', name: 'Ada' });
    await first.posts.create({ id: 'p1', title: 'One', authorId: 'ada' });
    await first.posts.create({ id: 'p2', title: 'Two', authorId: 'ada' });

    // p1 goes, p2 throws: ada is still there and the run says a release began.
    await expect(first.users.delete('ada')).rejects.toThrow('the process went away');
    expect(await ids(first.posts)).toEqual(['p2']);
    expect(await ids(first.users)).toEqual(['ada']);
    const run = (await first.runs.list())[0] as any;
    expect(run).toMatchObject({ id: 'user:ada', entity: 'user', key: 'ada', status: 'running' });
    await first.app.dispose();

    // The process comes back, the lease has expired, and the sweep redoes the whole release.
    const second = await booting();
    const expired = (await second.runs.findById('user:ada')) as any;
    await second.runs.update('user:ada', { leaseUntil: 0 });
    expect(expired.status).toBe('running');

    const swept = await createLocalRunner(second.app)(
      { entity: 'run', op: 'sweep' }, Invocation.empty,
    ) as { resumed: string[] };
    expect(swept.resumed).toEqual(['user:ada']);
    expect(await ids(second.posts)).toEqual([]);
    await second.app.dispose();
  });

  it('writes no run for the rows that carry one', async () => {
    rows.clear();
    const world = await booting();
    await world.users.create({ id: 'ada', name: 'Ada' });
    await world.users.delete('ada');

    // One run for `user:ada`, and none for the run itself — what carries a release writes none.
    expect(await ids(world.runs)).toEqual(['user:ada']);
    await world.app.dispose();
  });
});
