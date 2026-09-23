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
  created, date, entity, json, oneOf, optional, primary, readOnly, ref, text, unique, updated, writeOnly,
} from '@fougere/schema';
import { createSqliteSource } from '@fougere/adapter-sql/sqlite';
import {
  Collector, createApp, createAppRunner, createLocalRunner, Crud, ErrorCode, frond, Invocation, Presenter,
  togetherKeyOf, type App, type Storage, type Transport,
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

/** Computed on the way out, for the WHOLE page at once — never one query per row. */
class AuthorPresenter extends Presenter(Author) {
  /** How many rows the presenter was handed, written on each of them. */
  pageSize(authors: Author[]): number[] {
    return authors.map(() => authors.length);
  }

  shout(authors: Author[]): string[] {
    return authors.map((author) => author.name.toUpperCase());
  }
}

/** A per-call value with no schema — what a collector answers for. */
class Caller {
  constructor(public readonly who: string) {}
}

/** The member the door fills — declared, so it reads the same at every placement. */
const door = { name: 'door', state: { who: text() } };

/** Reads `ctx.state`, which is what every door fills. */
class CallerCollector extends Collector(Caller) {
  async collect(ctx: { state: Record<string, unknown> }): Promise<Caller> {
    return new Caller(String(ctx.state.who ?? 'nobody'));
  }
}

/** Writes both entities as one block — what `Together<[…]>` is for. */
class LedgerHandler {
  constructor(private together: unknown) {}

  /** Never called: what is under test is that the BOOT refuses it once they are apart. */
  async write(): Promise<{ ok: true }> {
    void this.together;

    return { ok: true };
  }
}

/** Asks for `Directory` by TYPE, so moving it between fronds may not be visible here. */
class CensusHandler {
  constructor(private directory: Directory) {}

  /** How many authors this app can see. */
  async count(): Promise<{ authors: number }> {
    return { authors: await this.directory.count() };
  }

  /** Who is asking — resolved by TYPE from what the door put on the call. */
  async who(caller: Caller): Promise<{ who: string }> {
    return { who: caller.who };
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
  /** The collector left behind in a frond that consumes it no longer. */
  strandCollector?: boolean;
  /** A frame over two entities, to see it refused once they are two processes. */
  frame?: boolean;
}

const fronds = ({ together = false, moved = false, strandCollector = false, frame = false }: Placement) => {
  const census = {
    ctor: CensusHandler,
    deps: ['Directory'],
    operations: {
      count: { binding: [] },
      who: { binding: [{ name: 'caller', optional: false, source: { kind: 'collector' as const, typeName: 'caller' } }] },
    },
  };
  // Through the repository, never the port: the boot refuses `AuthorStorage` here, and it
  // is right — a repository answers every gesture and survives the entity joining an aggregate.
  const service = { ctor: Directory, deps: ['AuthorRepository'] };
  // A frame over two entities, named the way a handler would: the boot refuses it the day one
  // of them answers in another process.
  const framed = frame
    ? [{ ctor: LedgerHandler, deps: [togetherKeyOf(['author', 'article'])], operations: { write: { binding: [] } } }]
    : [];

  if (together) {
    return [frond('app', {
      entities: [Author, Article],
      handlers: [AuthorHandler, ArticleHandler, census, ...framed],
      presenters: [AuthorPresenter],
      collectors: [CallerCollector],
      providers: [service],
    })];
  }

  return [
    frond('people', {
      entities: [Author],
      handlers: [AuthorHandler, ...(moved ? [] : [census]), ...framed],
      presenters: [AuthorPresenter],
      // A collector lives in the frond that CONSUMES it — one in the wrong frond refuses the
      // boot, which is its own invariant and not something a placement may soften.
      collectors: [CallerCollector],
      providers: moved ? [] : [service],
    }),
    frond('writing', {
      entities: [Article],
      handlers: [ArticleHandler, ...(moved ? [census] : [])],
      // Stranded: `census` moved here and its collector did not follow.
      collectors: moved && !strandCollector ? [CallerCollector] : [],
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
      createContainer, ...layer, fronds: fronds(placement), extensions: [door],
      remotes: { writing: 'http://writing.test' },
      remoteTransport: (): Transport => (c, i) => createLocalRunner(writing)(c, i),
    } as never);
    writing = await createApp({
      createContainer, ...layer, fronds: fronds(placement), extensions: [door],
      remotes: { people: 'http://people.test' },
      remoteTransport: (): Transport => (c, i) => createLocalRunner(people)(c, i),
    } as never);
  } else {
    people = writing = await createApp({ createContainer, ...layer, fronds: fronds(placement), extensions: [door] } as never);
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

describe('presenter — the page is handed over whole', () => {
  it.each(cases)('computes over the page, not over a row — %s', async (_name, where) => {
    const one = await world(where);
    for (const name of ['Ada', 'Bob', 'Carol']) {
      await ask(one, 'author', 'create', { name, email: `${name}@b.co` });
    }

    // `pageSize` writes how many rows it was handed. Three means one call for the page; one
    // would mean a query per row, which is the failure a presenter exists to make impossible.
    const { items } = await ask(one, 'author', 'list', {}) as { items: { pageSize: number; shout: string }[] };
    expect(items.map((row) => row.pageSize)).toEqual([3, 3, 3]);
    expect(items.map((row) => row.shout).sort()).toEqual(['ADA', 'BOB', 'CAROL']);
    await one.dispose();
  });
});

describe('collector — resolved by type, from what the door filled', () => {
  it.each(cases)('hands the handler what the call carried — %s', async (_name, where) => {
    const one = await world(where);

    const answered = await one.call(
      { entity: 'census', op: 'who' },
      { ...Invocation.empty, state: { who: 'ada' } as never },
    );
    expect(answered).toEqual({ who: 'ada' });
    await one.dispose();
  });

  it.each(cases)('answers its own default when the door filled nothing — %s', async (_name, where) => {
    const one = await world(where);

    expect(await ask(one, 'census', 'who', {})).toEqual({ who: 'nobody' });
    await one.dispose();
  });
});

describe('what a placement may not soften — the refusals', () => {
  it('refuses at boot a collector declared where nothing consumes it', async () => {
    // The rule is its own invariant: a collector lives in the frond that CONSUMES it, and no
    // placement makes that negotiable. Here `census` moves away from the collector's frond.
    await expect(world({ moved: true, strandCollector: true }))
      .rejects.toThrow(/collector/i);
  });

  it('refuses at boot a frame whose member answers in another process', async () => {
    // `Together<[…]>` states that these two may not be separated by a change of topology —
    // the one place where moving a boundary is refused out loud instead of quietly weakening.
    await expect(world({ apart: true, frame: true }))
      .rejects.toThrow(/remotes:/);
  });
});

/** Who the door says is calling — a date inside, which JSON turns into text on the wire. */
class Member extends entity({ id: primary(), name: text(), since: date() }) {}

/** The member the door put on the call, read by the entity the collector names. */
class MemberCollector extends Collector(Member) {
  async collect(ctx: { state: Record<string, unknown> }): Promise<Member | undefined> {
    return ctx.state.user as Member | undefined;
  }
}

class VisitHandler {
  async read(member: Member): Promise<{ sinceType: string }> {
    return { sinceType: Object.prototype.toString.call(member.since) };
  }
}

const visits = () => frond('visits', {
  handlers: [{
    ctor: VisitHandler,
    deps: [],
    operations: { read: { binding: [{ name: 'member', optional: false, source: { kind: 'collector' as const, typeName: 'member' } }] } },
  }],
  collectors: [MemberCollector],
});

/** Who fills `user`, and so the one process that declares it. */
const session = { name: 'session', state: { user: json(Member) } };

/** What crosses between two processes: the invocation as JSON, marked by the receiver as crossed. */
const acrossTheWire = (run: Transport): Transport => (call, invocation) =>
  run(call, { ...JSON.parse(JSON.stringify(invocation)), crossed: true });

describe('state — judged where it entered, read the same at every placement', () => {
  const signedIn = { ...Invocation.empty, state: { user: { id: 'u-1', name: 'Ada', since: new Date(0) } } };

  it('in-process', async () => {
    await using app = await createApp({ createContainer, fronds: [visits()], extensions: [session] } as never);

    expect(await createLocalRunner(app)({ entity: 'visit', op: 'read' }, signedIn as never))
      .toEqual({ sinceType: '[object Date]' });
  });

  it('across the wire, to a process that declares nothing', async () => {
    await using receiver = await createApp({ createContainer, fronds: [visits()] } as never);
    await using entry = await createApp({
      createContainer,
      fronds: [visits()],
      extensions: [session],
      remotes: { visits: 'http://visits.test' },
      remoteTransport: (): Transport => acrossTheWire(createLocalRunner(receiver)),
    } as never);

    expect(await createAppRunner(entry)({ entity: 'visit', op: 'read' }, signedIn as never))
      .toEqual({ sinceType: '[object Date]' });
  });

  it('refuses at the entry a member nobody there declares', async () => {
    await using receiver = await createApp({ createContainer, fronds: [visits()] } as never);
    await using entry = await createApp({
      createContainer,
      fronds: [visits()],
      remotes: { visits: 'http://visits.test' },
      remoteTransport: (): Transport => acrossTheWire(createLocalRunner(receiver)),
    } as never);

    await expect(createAppRunner(entry)({ entity: 'visit', op: 'read' }, signedIn as never))
      .rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED, message: expect.stringContaining('state.user: Unknown field') });
  });
});

/**
 * What this bench still cannot say, and why — a `todo` is a claim nobody has checked, which is
 * the only honest way to leave one.
 */
describe.todo('still unmeasured across placements', () => {
  // A middleware covers the addresses its frond SERVES — an assertion about scope, and the
  // bench varies placement, not scope. `core/tests/middleware.test.ts` is where it belongs.
  it.todo('middleware: it runs around its own frond’s addresses and around no others');
  // An emission does not cross a process without a carrier, and that IS the invariant — what
  // would be measured here is a carrier, which is a subject of its own.
  it.todo('Emit<T>: reached in one process, and announced rather than carried across');
  // A LINK does cross, and `core/tests/pipe.test.ts` pins it there: it has an address, so it
  // answers the same behind `remotes:` — and its failure stops the announcement either way.
});
