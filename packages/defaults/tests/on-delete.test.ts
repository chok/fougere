/**
 * One declaration, four placements, one answer — on real databases.
 *
 * `ref(User, { onDelete })` never changes. What changes is who carries it out: the engine at
 * the rows, the guard in this process, or the process that holds them. The gradient's whole
 * claim is that the ROWS end up the same, and it takes a real engine to say so — a Map that
 * declares `enforces: 'relation'` promises what nothing behind it can keep, so the keyed
 * placement would do nothing at all and the comparison would be between a working guard and
 * an absent engine.
 *
 * What legitimately differs is the COST, and the bench counts it: a tree one engine owns whole
 * is one statement and no lookup; every other placement reads before it writes.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createContainer } from '@fougere/container';
import { entity, optional, primary, ref, text } from '@fougere/schema';
import { createSqliteSource } from '@fougere/adapter-sql/sqlite';
import { createApp, createLocalRunner, Crud, frond, type App, type Storage, type Transport } from '@fougere/core';
import { layerOf, storageFrom } from '../src/storage/ResolvedStorage.js';

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
  /** Unstated on purpose: an undeclared `ref` means restrict, which is what a key already does. */
  authorId: ref(User),
}) {}

class UserHandler extends Crud(User) {}
class PostHandler extends Crud(Post) {}
class CommentHandler extends Crud(Comment) {}

/** The same entities, as one frond or as two — declared the same way in every process. */
const fronds = (together: boolean) => (together
  ? [frond('app', { entities: [User, Post, Comment], handlers: [UserHandler, PostHandler, CommentHandler] })]
  : [
    frond('people', { entities: [User], handlers: [UserHandler] }),
    frond('blog', { entities: [Post, Comment], handlers: [PostHandler, CommentHandler] }),
  ]);

/**
 * The three boundaries, and they are not the same thing: a FROND owns, a SOURCE commits, a
 * PROCESS is trusted. The declaration names none of them, so crossing any one of them must
 * leave the rows identical — and most of these cases should be indistinguishable. The ones
 * that are not are what the bench is for.
 */
interface Placement {
  /** One frond holding everything — the rung every project starts on. */
  together?: boolean;
  /** Two databases: `comment` goes to its own file, so one hop leaves the engine. */
  split?: boolean;
  /** Two processes: `blog` answers in the other app, reached through `remotes:`. */
  apart?: boolean;
}

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

interface Bench {
  users: Storage;
  posts: Storage;
  comments: Storage;
  /** Reverse lookups the release made — zero when one engine owns the whole tree. */
  reads: () => number;
  dispose: () => Promise<void>;
}

async function bench({ together = false, split = false, apart = false }: Placement): Promise<Bench> {
  const dir = mkdtempSync(join(tmpdir(), 'on-delete-'));
  dirs.push(dir);

  const said: string[] = [];
  const spies = (['debug', 'info', 'log', 'warn', 'error'] as const)
    .map((method) => vi.spyOn(console, method).mockImplementation((...parts) => { said.push(parts.join(' ')); }));

  // ONE set of files, opened by both processes — what varies is who decides, not who stores.
  const storage = storageFrom(split
    ? {
      db: createSqliteSource({ path: join(dir, 'app.db') }),
      sources: { archive: { source: createSqliteSource({ path: join(dir, 'archive.db') }), entities: ['Comment'] } },
    }
    : { db: createSqliteSource({ path: join(dir, 'app.db') }) });

  // `layerOf`, so the data layer travels whole — naming a few members is how `transacted` and
  // `close` were once left behind. Only the factory is wrapped, to count what a release reads.
  const read = vi.fn();
  const layer = layerOf(storage);
  const counted: typeof layer = {
    ...layer,
    storageFactory: (schema, name) => {
      const built = layer.storageFactory!(schema, name);

      return Object.assign(Object.create(built), {
        findAllByKeys: (field: string, keys: readonly string[]) => {
          read(name);

          return (built as never as Storage).findAllByKeys(field, keys);
        },
      });
    },
  };

  // Two processes that MIRROR each other: each hosts one frond and declares the other remote.
  // A peer that also hosted the far side would answer every question locally, and the crossing
  // the bench exists to exercise would never happen.
  let people: App | undefined;
  let blog: App | undefined;
  const crossing = apart;

  if (crossing) {
    people = await createApp({
      createContainer, ...counted, fronds: fronds(together),
      remotes: { blog: 'http://blog.test' },
      remoteTransport: (): Transport => (call, invocation) => createLocalRunner(blog!)(call, invocation),
    } as never);
    blog = await createApp({
      createContainer, ...counted, fronds: fronds(together),
      remotes: { people: 'http://people.test' },
      remoteTransport: (): Transport => (call, invocation) => createLocalRunner(people!)(call, invocation),
    } as never);
  } else {
    people = blog = await createApp({ createContainer, ...counted, fronds: fronds(together) } as never);
  }

  await storage.migrate!(people as never);
  for (const spy of spies) spy.mockRestore();

  const rows = (app: App, name: string) => app.storageFor(name) as Storage;

  return {
    users: rows(people!, 'user'),
    posts: rows(blog!, 'post'),
    comments: rows(blog!, 'comment'),
    reads: () => read.mock.calls.length,
    dispose: async () => {
      await people!.dispose();
      if (blog !== people) await blog!.dispose();
      await storage.close?.();
    },
  };
}

/** ada writes p1 and p2, carol edits p1, and a comment hangs off p1. */
async function populated(world: Bench): Promise<Bench> {
  await world.users.create({ id: 'ada', name: 'Ada' });
  await world.users.create({ id: 'carol', name: 'Carol' });
  await world.posts.create({ id: 'p1', title: 'One', authorId: 'ada', editorId: 'carol' });
  await world.posts.create({ id: 'p2', title: 'Two', authorId: 'ada' });
  await world.users.create({ id: 'bob', name: 'Bob' });
  await world.comments.create({ id: 'c1', body: 'nice', postId: 'p1', authorId: 'bob' });

  return world;
}

const ids = async (storage: Storage) => (await storage.list()).map((row: any) => row.id).sort();

const PLACEMENTS = {
  // The rung a project starts on: one frond, one file, one process. Nothing is declared.
  'one frond': { together: true },
  'one frond, two sources': { together: true, split: true },
  'two fronds': {},
  'two fronds, two sources': { split: true },
  'two processes': { apart: true },
  'two processes, two sources': { apart: true, split: true },
} satisfies Record<string, Placement>;

describe('the same declaration, wherever the rows sit', () => {
  it.each(Object.entries(PLACEMENTS))('cascade takes the whole tree — %s', async (_placement, where) => {
    const world = await populated(await bench(where));

    await expect(world.users.delete('ada')).resolves.toBe(true);
    expect({
      users: await ids(world.users),
      posts: await ids(world.posts),
      comments: await ids(world.comments),
    }).toEqual({ users: ['bob', 'carol'], posts: [], comments: [] });
    await world.dispose();
  });

  it.each(Object.entries(PLACEMENTS))('set null empties the field and keeps the row — %s', async (_placement, where) => {
    const world = await populated(await bench(where));

    await expect(world.users.delete('carol')).resolves.toBe(true);
    expect(await ids(world.posts)).toEqual(['p1', 'p2']);
    expect((await world.posts.findById('p1'))!.editorId).toBeNull();
    await world.dispose();
  });

  it.each(Object.entries(PLACEMENTS))('restrict refuses while a row names it — %s', async (_placement, where) => {
    const world = await populated(await bench(where));

    // bob wrote c1 and nothing says what becomes of it, so bob stays. What refuses differs —
    // a driver error under the key, a `FougereError` under the guard — and the row is the same.
    await expect(world.users.delete('bob')).rejects.toThrow();
    expect(await ids(world.users)).toEqual(['ada', 'bob', 'carol']);

    await world.comments.delete('c1');
    await expect(world.users.delete('bob')).resolves.toBe(true);
    await world.dispose();
  });
});

describe('what the placement costs', () => {
  it('reads nothing when one engine owns the whole tree', async () => {
    const world = await populated(await bench({}));

    await world.users.delete('ada');
    expect(world.reads()).toBe(0);
    await world.dispose();
  });

  it('reads before it writes as soon as one hop leaves that engine', async () => {
    const world = await populated(await bench({ split: true }));

    await world.users.delete('ada');
    expect(world.reads()).toBeGreaterThan(0);
    await world.dispose();
  });
});

describe('the crossing goes both ways', () => {
  // The delete travels from the side that owns the users; the WRITE's check travels the other
  // way, and it took a mirrored setup to notice it was not travelling at all.
  it('refuses a post naming an author the other process does not hold', async () => {
    const world = await bench({ apart: true });

    await expect(world.posts.create({ id: 'p1', title: 'One', authorId: 'nobody' }))
      .rejects.toThrow(/authorId "nobody" — no user holds it/);

    await world.users.create({ id: 'ada', name: 'Ada' });
    await expect(world.posts.create({ id: 'p1', title: 'One', authorId: 'ada' })).resolves.toBeDefined();
    await world.dispose();
  });
});

describe('a chain cut twice, and code that is not here', () => {
  /** Three processes: users, posts, comments — each hosting one thing and declaring the rest. */
  async function threeWays(carriesEveryFrond: boolean) {
    const dir = mkdtempSync(join(tmpdir(), 'on-delete-three-'));
    dirs.push(dir);
    const said: string[] = [];
    const spies = (['debug', 'info', 'log', 'warn', 'error'] as const)
      .map((method) => vi.spyOn(console, method).mockImplementation((...parts) => { said.push(parts.join(' ')); }));

    const storage = storageFrom({ db: createSqliteSource({ path: join(dir, 'app.db') }) });
    // Migrated ONCE, by an app that carries every frond: a process holding only its own cannot
    // write a table whose key names an entity it has never seen. What each process can migrate
    // is a subject of its own, and not what this bench is about.
    const { migrate: _migrated, ...layer } = layerOf(storage);

    const people = frond('people', { entities: [User], handlers: [UserHandler] });
    const blog = frond('blog', { entities: [Post], handlers: [PostHandler] });
    const talk = frond('talk', { entities: [Comment], handlers: [CommentHandler] });

    let a: App; let b: App; let c: App;
    const to = (get: () => App): Transport => (call, invocation) => createLocalRunner(get())(call, invocation);
    /**
     * What a process CARRIES is not what it hosts. `fougere sync` writes a card and no sources,
     * so a process may declare a remote whose entities it has never seen — and then it cannot
     * know that rows over there name its own.
     */
    const carried = (own: ReturnType<typeof frond>) =>
      (carriesEveryFrond ? [people, blog, talk] : [own]);

    const open = async (own: ReturnType<typeof frond>, remotes: Record<string, string>, pick: Record<string, () => App>) =>
      createApp({
        createContainer, ...layer, fronds: carried(own), remotes,
        remoteTransport: (url: string): Transport => to(pick[url]!),
      } as never);

    a = await open(people, { blog: 'b', talk: 'c' }, { b: () => b, c: () => c });
    b = await open(blog, { people: 'a', talk: 'c' }, { a: () => a, c: () => c });
    c = await open(talk, { people: 'a', blog: 'b' }, { a: () => a, b: () => b });
    const whole = await createApp({ createContainer, ...layerOf(storage), fronds: [people, blog, talk] } as never);
    await whole.dispose();
    for (const spy of spies) spy.mockRestore();

    return {
      users: a.storageFor('user') as Storage,
      posts: b.storageFor('post') as Storage,
      comments: c.storageFor('comment') as Storage,
      dispose: async () => { await a.dispose(); await b.dispose(); await c.dispose(); await storage.close?.(); },
    };
  }

  it.each([['every frond carried', true], ['only its own frond carried', false]])(
    'walks user → post → comment across three processes — %s',
    async (_what, carries) => {
      const world = await threeWays(carries as boolean);
      await world.users.create({ id: 'ada', name: 'Ada' });
      await world.users.create({ id: 'bob', name: 'Bob' });
      await world.posts.create({ id: 'p1', title: 'One', authorId: 'ada' });
      await world.comments.create({ id: 'c1', body: 'nice', postId: 'p1', authorId: 'bob' });

      await expect(world.users.delete('ada')).resolves.toBe(true);
      expect(await ids(world.posts)).toEqual([]);
      // The comment lives in a third process, two hops from the row that went.
      expect(await ids(world.comments)).toEqual([]);
      await world.dispose();
    },
  );
});

/**
 * What the gradient promises, as a list.
 *
 * Every line below must answer the same at every placement. They are not all covered here —
 * what is written is what this bench can say today, and what is not is named rather than
 * implied. A `todo` is a claim nobody has checked, which is the only honest way to leave one.
 */
describe.todo('every invariant that must survive a placement', () => {
  it.todo('unique: refused at the rows, or announced at boot — never silently absent');
  it.todo('validation: the same input is refused with the same code, wherever it lands');
  it.todo('lifecycle: created() and updated() are stamped by whoever writes, not by who asks');
  it.todo('boundary: a readOnly field is refused inbound at every surface');
  it.todo('presenter: the page is handed over whole, and the field count does not move');
  it.todo('collector: resolved by type, and a collector in the wrong frond refuses the boot');
  it.todo('middleware: it runs around the addresses its frond serves, and around no others');
  it.todo('Emit<T>: every subscriber is handed the fact, in one process or across');
  it.todo('Pipe<T>: the declared order holds, and a link that answers nothing refuses');
  it.todo('Together: refused across processes, by definition — the refusal IS the invariant');
});

/**
 * Moving code, not rows.
 *
 * The three boundaries above move where things LIVE. This one moves where they are DECLARED:
 * an entity, a handler or a service changes frond, and nothing about the answers may move with
 * it. What legitimately changes is the reach, the boot lines and the card.
 */
describe.todo('the cut holds when the code moves', () => {
  it.todo('an entity declared in another frond: same keys, same refusals, same rows');
  it.todo('a handler moved: the address follows it, and every surface still serves it');
  it.todo('a service moved: resolved by type, so its consumers do not name its frond');
  it.todo('a handler naming a neighbour facade: local and remote answer the same');
});
