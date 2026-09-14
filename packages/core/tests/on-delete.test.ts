/**
 * What a delete does to the rows that name it.
 *
 * `restrict` refuses, `cascade` takes them out, `set null` empties the field — and who does the
 * work is the pair's, never the engine's: both sides in one source that keeps relations and the
 * foreign key answers at the rows, so nothing here reads anything. Anywhere else the guard walks
 * the tree itself, deepest FIRST, which is the whole guarantee: an interruption leaves fewer
 * children and never an orphan.
 */
import { describe, it, expect, vi } from 'vitest';
import { createContainer, type Container } from '@fougere/container';
import { entity, optional, primary, ref, text, type SchemaView } from '@fougere/schema';
import {
  createApp, createLocalRunner, Crud, frond, Invocation, storageOver, togetherKeyOf,
  type Storage, type Store,
} from '../src/index.js';

class User extends entity({ id: primary(text()), name: text() }) {}
class Post extends entity({
  id: primary(text()),
  title: text(),
  authorId: ref(User, { onDelete: 'cascade' }),
  editorId: optional(ref(User, { onDelete: 'set null' })),
}) {}
class Comment extends entity({
  id: primary(text()),
  body: text(),
  postId: ref(Post, { onDelete: 'cascade' }),
  authorId: ref(User, { onDelete: 'restrict' }),
}) {}

interface Frame { run<R>(block: (entities: Storage[]) => Promise<R>): Promise<R> }

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

interface Boot {
  /** The source each entity lives in — `db` when unnamed. */
  sources?: Record<string, string>;
  /** Whether a source keeps relations at all. Both sides in one that does = the engine's job. */
  enforces?: boolean;
  fronds?: ReturnType<typeof frond>[];
  /** Wrapped around a storage the boot builds, so a test can watch or break one gesture. */
  around?: (entity: string, storage: Storage) => Storage;
}

const oneFrond = () => [frond('app', { entities: [User, Post, Comment] })];

const booting = async ({ sources = {}, enforces = false, fronds = oneFrond(), around }: Boot = {}) => {
  const lines: string[] = [];
  const spies = (['debug', 'info', 'log', 'warn', 'error'] as const)
    .map((method) => vi.spyOn(console, method)
      .mockImplementation((...said: unknown[]) => { lines.push(said.join(' ')); }));

  const stores = new Map<string, Store>();
  const base = storageOver((_entity: SchemaView, name: string) => {
    const made = stores.get(name) ?? store();
    stores.set(name, made);

    return made;
  });

  const app = await createApp({
    createContainer,
    storageFactory: (schema, name) => {
      const built = base(schema, name);

      return around ? around(name, built) : built;
    },
    sourceOf: (name) => sources[name] ?? 'db',
    enforces: (_source, constraint) => enforces && constraint === 'relation',
    fronds,
  });
  for (const spy of spies) spy.mockRestore();

  const of = (name: string) => app.storageFor(name) as Storage;

  return {
    app, of,
    users: of('user'), posts: of('post'), comments: of('comment'),
    refused: lines.filter((line) => line.includes('on-delete') || line.includes('set null')),
    dispose: () => app.dispose(),
  };
};

/** ada writes p1 and p2, bob comments on p1. carol edits p1. */
const populated = async (world: Awaited<ReturnType<typeof booting>>) => {
  await world.users.create({ id: 'ada', name: 'Ada' });
  await world.users.create({ id: 'bob', name: 'Bob' });
  await world.users.create({ id: 'carol', name: 'Carol' });
  await world.posts.create({ id: 'p1', title: 'One', authorId: 'ada', editorId: 'carol' });
  await world.posts.create({ id: 'p2', title: 'Two', authorId: 'ada' });
  await world.comments.create({ id: 'c1', body: 'nice', postId: 'p1', authorId: 'bob' });

  return world;
};

const rows = async (storage: Storage) => (await storage.list()).map((row: any) => row.id).sort();

describe('restrict — the row stays until nothing names it', () => {
  it('refuses, naming the entity, the field and how many rows', async () => {
    const world = await populated(await booting());

    await expect(world.users.delete('bob')).rejects.toThrow(/comment\.authorId holds 1 row\(s\)/);
    expect(await rows(world.users)).toEqual(['ada', 'bob', 'carol']);
    await world.dispose();
  });

  it('lets the delete through once they are gone', async () => {
    const world = await populated(await booting());
    await world.comments.delete('c1');

    await expect(world.users.delete('bob')).resolves.toBe(true);
    await world.dispose();
  });

  it('is what an undeclared ref means — a key with no action refuses too', async () => {
    class Bare extends entity({ id: primary(text()), userId: ref(User) }) {}
    const world = await booting({ fronds: [frond('app', { entities: [User, Bare] })] });
    await world.users.create({ id: 'ada', name: 'Ada' });
    await world.of('bare').create({ id: 'b1', userId: 'ada' });

    await expect(world.users.delete('ada')).rejects.toThrow(/bare\.userId holds 1 row\(s\)/);
    await world.dispose();
  });

  it('sees a namer declared in another frond', async () => {
    const world = await populated(await booting({
      fronds: [frond('people', { entities: [User] }), frond('blog', { entities: [Post, Comment] })],
    }));

    await expect(world.users.delete('bob')).rejects.toThrow(/comment\.authorId/);
    await world.dispose();
  });

  it('refuses inside a frame, where the storage is rebuilt', async () => {
    const key = togetherKeyOf(['user']);
    class Purge {}
    const world = await populated(await booting({
      fronds: [frond('app', {
        entities: [User, Post, Comment],
        handlers: [{ ctor: Purge, deps: [key] }],
      })],
    }));
    const frame = world.app.container.resolve<Container>('frond:app').resolve<Frame>(key);

    await expect(frame.run(([users]) => users.delete('bob'))).rejects.toThrow(/comment\.authorId/);
    await world.dispose();
  });

  it('refuses through the facade, not only the storage', async () => {
    class UserHandler extends Crud(User) {}
    const world = await populated(await booting({
      fronds: [frond('app', { entities: [User, Post, Comment], handlers: [UserHandler] })],
    }));
    const call = createLocalRunner(world.app);

    await expect(call({ entity: 'user', op: 'delete' }, { ...Invocation.empty, params: { id: 'bob' } as never }))
      .rejects.toThrow(/comment\.authorId/);
    await world.dispose();
  });
});

describe('a source that keeps relations', () => {
  it('reads nothing — the key answers at the rows, and nothing here would see it', async () => {
    const read = vi.fn();
    const world = await populated(await booting({
      enforces: true,
      around: (_name, storage) => Object.assign(Object.create(storage), {
        findAllByKeys: (...args: never[]) => { read(...args); return (storage as any).findAllByKeys(...args); },
      }),
    }));

    // No key exists on this storage, so the row goes: the point is that the guard asked no one.
    await expect(world.users.delete('bob')).resolves.toBe(true);
    expect(read).not.toHaveBeenCalled();
    await world.dispose();
  });
});

describe('cascade — the rows that name it go first', () => {
  it('takes the children out, then the row', async () => {
    const world = await populated(await booting());

    await expect(world.users.delete('ada')).resolves.toBe(true);
    expect(await rows(world.posts)).toEqual([]);
    expect(await rows(world.users)).toEqual(['bob', 'carol']);
    await world.dispose();
  });

  it('walks a chain of three, deepest first', async () => {
    const world = await populated(await booting());

    await expect(world.users.delete('ada')).resolves.toBe(true);
    expect(await rows(world.comments)).toEqual([]);
    expect(await rows(world.posts)).toEqual([]);
    await world.dispose();
  });

  it('a restrict at the bottom stops everything, including the top', async () => {
    // user → note (cascade) → mark (restrict): deleting the user would take the note, and the
    // note may not go while a mark names it. Nothing moves, two levels up.
    class Note extends entity({ id: primary(text()), userId: ref(User, { onDelete: 'cascade' }) }) {}
    class Mark extends entity({ id: primary(text()), noteId: ref(Note, { onDelete: 'restrict' }) }) {}
    const world = await booting({ fronds: [frond('app', { entities: [User, Note, Mark] })] });
    await world.users.create({ id: 'ada', name: 'Ada' });
    await world.of('note').create({ id: 'n1', userId: 'ada' });
    await world.of('mark').create({ id: 'm1', noteId: 'n1' });

    await expect(world.users.delete('ada')).rejects.toThrow(/mark\.noteId holds 1 row\(s\)/);
    expect(await rows(world.of('note'))).toEqual(['n1']);
    expect(await rows(world.users)).toEqual(['ada']);
    await world.dispose();
  });

  it('a comment goes with its post, though its author is restrict — they are two questions', async () => {
    const world = await populated(await booting());

    // `comment.authorId restrict` says the USER bob may not go while c1 lives. It says nothing
    // about p1 going: c1 names p1 with cascade, so deleting ada takes p1 and c1 with it.
    await expect(world.users.delete('ada')).resolves.toBe(true);
    expect(await rows(world.comments)).toEqual([]);
    expect(await rows(world.users)).toEqual(['bob', 'carol']);
    await world.dispose();
  });

  it('stops where it failed, and what is gone stays gone — fewer children, never an orphan', async () => {
    let fail = false;
    const world = await populated(await booting({
      around: (name, storage) => (name !== 'post' ? storage : Object.assign(Object.create(storage), {
        delete: async (id: string) => {
          if (fail && id === 'p2') throw new Error('the disk went away');

          return (storage as any).delete(id);
        },
      })),
    }));
    await world.comments.delete('c1');
    fail = true;

    await expect(world.users.delete('ada')).rejects.toThrow('the disk went away');
    // p1 is gone, p2 is not, ada is still there: a re-run finishes it.
    expect(await rows(world.posts)).toEqual(['p2']);
    expect(await rows(world.users)).toEqual(['ada', 'bob', 'carol']);

    fail = false;
    await expect(world.users.delete('ada')).resolves.toBe(true);
    expect(await rows(world.posts)).toEqual([]);
    await world.dispose();
  });

  it('ends on a self-reference, and on a cycle between two entities', async () => {
    class Node extends entity({
      id: primary(text()),
      parentId: optional(ref((): any => Node, { onDelete: 'cascade' })),
    }) {}
    const world = await booting({ fronds: [frond('tree', { entities: [Node] })] });
    const nodes = world.of('node');
    await nodes.create({ id: 'root' });
    await nodes.create({ id: 'child', parentId: 'root' });
    await nodes.create({ id: 'leaf', parentId: 'child' });

    await expect(nodes.delete('root')).resolves.toBe(true);
    expect(await rows(nodes)).toEqual([]);
    await world.dispose();
  });

  it('reads once per relation, whatever the page holds', async () => {
    const read = vi.fn();
    const world = await booting({
      around: (name, storage) => (name !== 'post' ? storage : Object.assign(Object.create(storage), {
        findAllByKeys: (...args: any[]) => { read(...args); return (storage as any).findAllByKeys(...args); },
      })),
    });
    await world.users.create({ id: 'ada', name: 'Ada' });
    for (let i = 0; i < 100; i++) await world.posts.create({ id: `p${i}`, title: 'x', authorId: 'ada' });

    await world.users.delete('ada');
    // `post` names `user` twice — authorId and editorId — and each is one read for the key.
    expect(read).toHaveBeenCalledTimes(2);
    expect(await rows(world.posts)).toEqual([]);
    await world.dispose();
  });
});

describe('set null — the row stays, the field is emptied', () => {
  it('empties the field and keeps the row', async () => {
    const world = await populated(await booting());

    await expect(world.users.delete('carol')).resolves.toBe(true);
    expect((await world.posts.findById('p1'))!.editorId).toBeNull();
    expect(await rows(world.posts)).toEqual(['p1', 'p2']);
    await world.dispose();
  });

  it('is refused at boot on a field that admits no null', async () => {
    class Tight extends entity({ id: primary(text()), userId: ref(User, { onDelete: 'set null' }) }) {}

    await expect(booting({ fronds: [frond('app', { entities: [User, Tight] })] }))
      .rejects.toThrow(/tight\.userId states onDelete 'set null'/);
  });
});

describe('two declarations about one target', () => {
  it('a restrict anywhere wins over a cascade beside it', async () => {
    class Both extends entity({
      id: primary(text()),
      ownerId: ref(User, { onDelete: 'cascade' }),
      approverId: ref(User, { onDelete: 'restrict' }),
    }) {}
    const world = await booting({ fronds: [frond('app', { entities: [User, Both] })] });
    await world.users.create({ id: 'ada', name: 'Ada' });
    await world.of('both').create({ id: 'b1', ownerId: 'ada', approverId: 'ada' });

    await expect(world.users.delete('ada')).rejects.toThrow(/both\.approverId/);
    expect(await rows(world.of('both'))).toEqual(['b1']);
    await world.dispose();
  });

  it('two fields of one entity are two dependents', async () => {
    const world = await populated(await booting());
    await world.comments.delete('c1');

    // ada authors p1 and p2 (cascade) while carol only edits p1 (set null): one target, two rules.
    await world.users.delete('carol');
    expect((await world.posts.findById('p1'))!.editorId).toBeNull();
    await world.users.delete('ada');
    expect(await rows(world.posts)).toEqual([]);
    await world.dispose();
  });
});

describe('an engine hop above a guard hop — the trap', () => {
  // An engine's cascade does not pass through the guard: it deletes the rows itself, and
  // nothing in this process sees it happen. So a hop the engine owns above a hop it does not
  // would leave the bottom of the tree behind.
  it('the guard takes the whole tree when one hop below is not keyed', async () => {
    const world = await populated(await booting({
      enforces: true,                      // the engine keeps relations…
      sources: { comment: 'archive' },     // …but the comment lives in another database.
    }));
    // bob's comment on ada's post: nothing names ada under `restrict`, so the walk goes on.
    await world.users.delete('ada');
    // Had `user → post` been left to the key, p1 would have gone with c1 still naming it.
    expect(await rows(world.comments)).toEqual([]);
    expect(await rows(world.posts)).toEqual([]);
    await world.dispose();
  });

  it('leaves a fully keyed tree to the engine, and reads nothing at any level', async () => {
    const read = vi.fn();
    const world = await populated(await booting({
      enforces: true,
      around: (_name, storage) => Object.assign(Object.create(storage), {
        findAllByKeys: (...args: any[]) => { read(...args); return (storage as any).findAllByKeys(...args); },
      }),
    }));

    await world.users.delete('ada');
    expect(read).not.toHaveBeenCalled();
    await world.dispose();
  });
});

describe('the rows live in another process', () => {
  // Two apps, one transport: A holds the users, B holds the posts and the comments. Nothing in
  // A can reach B's rows, so the ask crosses — and the work happens on B's side, through the
  // two readings core serves in every process.
  const twoProcesses = async () => {
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

    // A facade per entity, because that is what a card carries and what the remote router
    // indexes an entity by — a frond with no handler is a frond a peer cannot find.
    class UserHandler extends Crud(User) {}
    class PostHandler extends Crud(Post) {}
    class CommentHandler extends Crud(Comment) {}
    const declared = () => [
      frond('people', { entities: [User], handlers: [UserHandler] }),
      frond('blog', { entities: [Post, Comment], handlers: [PostHandler, CommentHandler] }),
    ];

    const blog = await createApp({ createContainer, storageFactory, fronds: declared() });

    const people = await createApp({
      createContainer, storageFactory,
      fronds: declared(),
      remotes: { blog: 'http://blog.test' },
      remoteTransport: () => createLocalRunner(blog),
    });
    for (const spy of spies) spy.mockRestore();

    return {
      users: people.storageFor('user') as Storage,
      posts: blog.storageFor('post') as Storage,
      comments: blog.storageFor('comment') as Storage,
      warned: lines.filter((line) => line.includes('[relations]')),
      dispose: async () => { await people.dispose(); await blog.dispose(); },
    };
  };

  it('asks the process that holds them, and its own tree goes with it', async () => {
    const world = await twoProcesses();
    await world.users.create({ id: 'ada', name: 'Ada' });
    await world.users.create({ id: 'bob', name: 'Bob' });
    await world.posts.create({ id: 'p1', title: 'One', authorId: 'ada' });
    await world.comments.create({ id: 'c1', body: 'nice', postId: 'p1', authorId: 'bob' });

    await expect(world.users.delete('ada')).resolves.toBe(true);
    expect(await rows(world.posts)).toEqual([]);
    // c1 named p1 with cascade: B walked its own tree before taking the post out.
    expect(await rows(world.comments)).toEqual([]);
    await world.dispose();
  });

  it('is refused by the other process when something there names the row', async () => {
    const world = await twoProcesses();
    await world.users.create({ id: 'bob', name: 'Bob' });
    await world.posts.create({ id: 'p1', title: 'One', authorId: 'bob' });
    await world.comments.create({ id: 'c1', body: 'nice', postId: 'p1', authorId: 'bob' });

    // `comment.authorId` is restrict, and the comment lives over there — the refusal crosses back.
    await expect(world.users.delete('bob')).rejects.toThrow(/comment\.authorId holds 1 row\(s\)/);
    expect(await rows(world.users)).toEqual(['bob']);
    await world.dispose();
  });
});
