/**
 * What a placement may not change.
 *
 * `demos/test-gradient` shows what a declaration writes on its own; `on-delete.test.ts` runs
 * ONE subject at every placement. This runs the others: the same input, the same refusal, the
 * same stamp, wherever the rows live and wherever the code is declared.
 *
 * Three boundaries move here and none of them is the same thing — a FROND owns, a SOURCE
 * commits, a PROCESS is trusted — plus a fourth that moves no rows at all: where the code is
 * DECLARED. Most of these cases must be indistinguishable. The ones that are not are named.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createContainer } from '@fougere/container';
import {
  created, entity, oneOf, optional, primary, readOnly, ref, text, unique, updated, writeOnly,
} from '@fougere/schema';
import { createSqliteSource } from '@fougere/adapter-sql/sqlite';
import {
  createApp, createLocalRunner, Crud, ErrorCode, frond, Invocation,
  type App, type Storage, type Transport,
} from '@fougere/core';
import { layerOf, storageFrom } from '../src/storage/ResolvedStorage.js';

class Author extends entity({
  /** Generated, so nothing in this bench chooses a key — the placement is the only variable. */
  id: primary(),
  /** The database keeps it, and a source that cannot says so at boot. */
  email: unique(text()),
  name: text({ min: 1 }),
  /** Never crosses inward: the server fills it, a client may not. */
  rank: readOnly(oneOf('member', 'admin', { default: 'member' })),
  /** Never crosses outward. */
  token: writeOnly(optional(text())),
  createdAt: created(),
  updatedAt: updated(),
}) {}

class Article extends entity({
  id: primary(),
  title: text({ min: 1 }),
  authorId: ref(Author),
}) {}

class AuthorHandler extends Crud(Author) {}
class ArticleHandler extends Crud(Article) {}

/** Reads the authors through their repository — a service whose consumers name no frond. */
class Directory {
  constructor(private authors: Storage<Author>) {}

  async count(): Promise<number> {
    return (await this.authors.list()).length;
  }
}

/** Asks for `Directory` by TYPE, so moving it between fronds may not be visible here. */
class CensusHandler {
  constructor(private directory: Directory) {}

  /** How many authors this app can see. */
  async count(): Promise<{ authors: number }> {
    return { authors: await this.directory.count() };
  }
}

interface Placement {
  /** One frond holding everything — the rung every project starts on. */
  together?: boolean;
  /** `Article` in its own database, so the reference leaves the engine. */
  split?: boolean;
  /** `writing` answers in another process, reached through `remotes:`. */
  apart?: boolean;
  /** The service declared in the OTHER frond — same type, another owner. */
  moved?: boolean;
}

const fronds = ({ together = false, moved = false }: Placement) => {
  // Through the repository, never the port: the boot refuses `AuthorStorage` here, and it
  // is right — a repository answers every gesture and survives the entity joining an aggregate.
  const service = { ctor: Directory, deps: ['AuthorRepository'] };

  if (together) {
    return [frond('app', {
      entities: [Author, Article],
      handlers: [AuthorHandler, ArticleHandler, { ctor: CensusHandler, deps: ['Directory'], operations: { count: { binding: [] } } }],
      providers: [service],
    })];
  }

  return [
    frond('people', {
      entities: [Author],
      handlers: [AuthorHandler, ...(moved ? [] : [{ ctor: CensusHandler, deps: ['Directory'], operations: { count: { binding: [] } } }])],
      providers: moved ? [] : [service],
    }),
    frond('writing', {
      entities: [Article],
      handlers: [ArticleHandler, ...(moved ? [{ ctor: CensusHandler, deps: ['Directory'], operations: { count: { binding: [] } } }] : [])],
      providers: moved ? [service] : [],
    }),
  ];
};

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

interface World {
  authors: Storage;
  articles: Storage;
  /** The client door — what a browser reaches, with its validator and its boundary. */
  call: Transport;
  said: string[];
  dispose: () => Promise<void>;
}

async function world(placement: Placement): Promise<World> {
  const dir = mkdtempSync(join(tmpdir(), 'gradient-'));
  dirs.push(dir);

  const said: string[] = [];
  const spies = (['debug', 'info', 'log', 'warn', 'error'] as const)
    .map((method) => vi.spyOn(console, method).mockImplementation((...parts) => { said.push(parts.join(' ')); }));

  const storage = storageFrom(placement.split
    ? {
      db: createSqliteSource({ path: join(dir, 'app.db') }),
      sources: { archive: { source: createSqliteSource({ path: join(dir, 'archive.db') }), entities: ['Article'] } },
    }
    : { db: createSqliteSource({ path: join(dir, 'app.db') }) });
  const layer = layerOf(storage);

  let people: App;
  let writing: App;
  if (placement.apart) {
    people = await createApp({
      createContainer, ...layer, fronds: fronds(placement),
      remotes: { writing: 'http://writing.test' },
      remoteTransport: (): Transport => (c, i) => createLocalRunner(writing)(c, i),
    } as never);
    writing = await createApp({
      createContainer, ...layer, fronds: fronds(placement),
      remotes: { people: 'http://people.test' },
      remoteTransport: (): Transport => (c, i) => createLocalRunner(people)(c, i),
    } as never);
  } else {
    people = writing = await createApp({ createContainer, ...layer, fronds: fronds(placement) } as never);
  }
  await storage.migrate!(people as never);
  for (const spy of spies) spy.mockRestore();

  return {
    authors: people.storageFor('author') as Storage,
    articles: writing.storageFor('article') as Storage,
    // Whichever process serves it; what the test asks is that the ANSWER does not move.
    call: (c, i) => (c.entity === 'article' ? createLocalRunner(writing) : createLocalRunner(people))(c, i),
    said,
    dispose: async () => {
      await people.dispose();
      if (writing !== people) await writing.dispose();
      await storage.close?.();
    },
  };
}

const PLACEMENTS = {
  'one frond': { together: true },
  'two fronds': {},
  'two fronds, two sources': { split: true },
  'two processes': { apart: true },
  'two processes, two sources': { apart: true, split: true },
} satisfies Record<string, Placement>;

const cases = Object.entries(PLACEMENTS);
/** The client door: what a row is made of travels as `input`, what NAMES one as `params`. */
const ask = (
  world: World,
  entity: string,
  op: string,
  input: Record<string, unknown>,
  params: Record<string, unknown> = {},
) => world.call({ entity, op }, { ...Invocation.empty, input: input as never, params: params as never });

describe('validation — the same input, the same refusal', () => {
  it.each(cases)('refuses an empty name with VALIDATION_FAILED — %s', async (_name, where) => {
    const one = await world(where);

    await expect(ask(one, 'author', 'create', { name: '', email: 'a@b.co' }))
      .rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
    await one.dispose();
  });

  it.each(cases)('refuses a key the entity does not declare — %s', async (_name, where) => {
    const one = await world(where);

    await expect(ask(one, 'author', 'create', { name: 'Ada', email: 'a@b.co', nickname: 'ada' }))
      .rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
    await one.dispose();
  });
});

describe('boundary — a readOnly field never crosses inward', () => {
  it.each(cases)('refuses a client writing rank, and fills its default — %s', async (_name, where) => {
    const one = await world(where);

    await expect(ask(one, 'author', 'create', { name: 'Ada', email: 'a@b.co', rank: 'admin' }))
      .rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });

    const made = await ask(one, 'author', 'create', { name: 'Ada', email: 'a@b.co' }) as { rank: string };
    expect(made.rank).toBe('member');
    await one.dispose();
  });
});

describe('lifecycle — the stamp belongs to whoever writes, not to whoever asks', () => {
  it.each(cases)('stamps createdAt without being given one — %s', async (_name, where) => {
    const one = await world(where);

    // A string on the way out — the client door projects it, and that is the same everywhere.
    const made = await ask(one, 'author', 'create', { name: 'Ada', email: 'a@b.co' }) as { createdAt: string };
    expect(Number.isNaN(Date.parse(made.createdAt))).toBe(false);
    await one.dispose();
  });

  it.each(cases)('re-stamps updatedAt on an update, and leaves createdAt — %s', async (_name, where) => {
    const one = await world(where);
    const made = await ask(one, 'author', 'create', { name: 'Ada', email: 'a@b.co' }) as
      { id: string; createdAt: string };

    const after = await ask(one, 'author', 'update', { name: 'Ada L.' }, { id: made.id }) as
      { createdAt: string; updatedAt: string };
    expect(Date.parse(after.createdAt)).toBe(Date.parse(made.createdAt));
    expect(Date.parse(after.updatedAt)).toBeGreaterThanOrEqual(Date.parse(made.createdAt));
    await one.dispose();
  });
});

describe('unique — kept at the rows, wherever they are', () => {
  it.each(cases)('refuses a second row with the same email — %s', async (_name, where) => {
    const one = await world(where);
    await ask(one, 'author', 'create', { name: 'Ada', email: 'a@b.co' });

    // The engine refuses, because it is the only one that can: two writes arriving together
    // see the same absence, and the judge at the door sees only what is already stored.
    await expect(ask(one, 'author', 'create', { name: 'Bob', email: 'a@b.co' })).rejects.toThrow();
    await one.dispose();
  });
});

describe('the cut holds when the code moves', () => {
  it.each(cases)('a service resolved by TYPE answers the same at every placement — %s', async (_name, where) => {
    const one = await world(where);
    await ask(one, 'author', 'create', { name: 'Ada', email: 'a@b.co' });
    await ask(one, 'author', 'create', { name: 'Bob', email: 'b@b.co' });

    expect(await ask(one, 'census', 'count', {})).toEqual({ authors: 2 });
    await one.dispose();
  });

  it('but it may not move to a frond that does not own what it reads', async () => {
    // A scope sees its parent and never its siblings, so `AuthorRepository` — registered by the
    // frond that owns the entity — is not reachable from another one. That is the ownership
    // boundary doing its job: a neighbour goes through the facade, not through the rows.
    const one = await world({ moved: true });
    await ask(one, 'author', 'create', { name: 'Ada', email: 'a@b.co' });

    await expect(ask(one, 'census', 'count', {})).rejects.toThrow(/'AuthorRepository' is not registered/);
    await one.dispose();
  });

  it.each(cases)('a reference across the cut is written and read the same — %s', async (_name, where) => {
    const one = await world(where);
    const ada = await ask(one, 'author', 'create', { name: 'Ada', email: 'a@b.co' }) as { id: string };

    const made = await ask(one, 'article', 'create', { title: 'One', authorId: ada.id }) as { authorId: string };
    expect(made.authorId).toBe(ada.id);
    // And a reference to nobody is refused, whoever holds the rows.
    await expect(ask(one, 'article', 'create', { title: 'Two', authorId: 'nobody' })).rejects.toThrow();
    await one.dispose();
  });
});

/**
 * What this bench cannot say yet, and why — a `todo` is a claim nobody has checked, which is
 * the only honest way to leave one.
 */
describe.todo('still unmeasured across placements', () => {
  // Needs a presenter and a page whose size the bench can vary.
  it.todo('presenter: the page is handed over whole, and the field count does not move');
  // A collector is resolved from `ctx.state`, so the bench needs a door that fills it.
  it.todo('collector: resolved by type, and one in the wrong frond refuses the boot');
  // A middleware covers the addresses its frond SERVES — the assertion is about scope, not rows.
  it.todo('middleware: it runs around its own frond’s addresses and around no others');
  // An emission does not cross a process without a carrier, which is itself the invariant.
  it.todo('Emit<T>: reached in one process, and announced rather than carried across');
  it.todo('Pipe<T>: the declared order holds, and a link that answers nothing refuses');
  // `Together` refuses a remote member at BOOT: the refusal is the invariant, not a result.
  it.todo('Together: refused across processes, by definition');
});
