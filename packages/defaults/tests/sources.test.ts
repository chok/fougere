/**
 * An entity's rows live where the app says, and the DDL stops pretending otherwise.
 *
 * Until now one `db:` held everything: `toTables` gathered every frond into ONE batch,
 * so a `ref()` always found its target and always got a foreign key. Cut per source,
 * a miss finally means something — and it means two different things, which is why
 * `elsewhere` exists.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { entity, primary, ref, text, updated } from '@fougere/schema';
import { toTables, setupKysely } from '@fougere/adapter-sql';
import { setupSqlite } from '@fougere/adapter-sql/sqlite';
import { SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import { resolveStorage, storageFrom } from '../src/storage.js';

class Reader extends entity({ id: primary(), name: text() }) {}
class Book extends entity({ id: primary(), title: text() }) {}
class Loan extends entity({ id: primary(), readerId: ref(Reader), bookId: ref(Book) }) {}

const app = {
  fronds: [
    { name: 'people', entities: [{ name: 'reader', entityClass: Reader }] },
    { name: 'catalog', entities: [{ name: 'book', entityClass: Book }] },
    { name: 'lending', entities: [{ name: 'loan', entityClass: Loan }] },
  ],
};

const fkOf = (tables: any[], table: string, column: string) =>
  tables.find((t) => t.name === table)?.columns.find((c: any) => c.name === column)?.references;

describe('the DDL of one source', () => {
  it('constrains what it hosts and leaves the rest a bare column', () => {
    // `catalog` lives elsewhere: the column stays, the foreign key goes. Two databases
    // share no constraint — that is physics, not a limit of the framework.
    const tables = toTables(
      { fronds: app.fronds.filter((f) => f.name !== 'catalog'), elsewhere: ['book'] } as never,
      (name) => `${name}s`,
    );

    expect(fkOf(tables, 'loans', 'reader_id')).toEqual({ table: 'readers', column: 'id' });
    expect(fkOf(tables, 'loans', 'book_id')).toBeUndefined();
    // The column itself is never dropped: the relation survives, only the pretence goes.
    expect(tables.find((t) => t.name === 'loans')!.columns.map((c) => c.name)).toContain('book_id');
  });

  it('refuses a target no source hosts, rather than reading it as a boundary', () => {
    // The dangerous case: a bad registration looks EXACTLY like a cross-source target.
    // Silence would turn a typo into a silently dropped constraint.
    expect(() => toTables(
      { fronds: app.fronds.filter((f) => f.name !== 'catalog'), elsewhere: [] } as never,
      (name) => `${name}s`,
    )).toThrow(/ref\(Book\): no source hosts it/);
  });

  it('keeps every constraint when nothing is declared elsewhere', () => {
    // One database, no `sources:` — the behaviour an existing app must keep.
    const tables = toTables(app as never, (name) => `${name}s`);
    expect(fkOf(tables, 'loans', 'book_id')).toEqual({ table: 'books', column: 'id' });
    expect(fkOf(tables, 'loans', 'reader_id')).toEqual({ table: 'readers', column: 'id' });
  });
});

describe('resolveStorage with a second source', () => {
  it('hands each entity the engine its source names', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fougere-sources-'));
    try {
      const storage = resolveStorage(
        { dialect: 'sqlite', path: join(dir, 'main.db') },
        { archive: { path: join(dir, 'archive.db'), entities: ['Book'] } },
      );
      await storage.migrate!(app as never);

      const readerStorage = storage.storageFactory!(Reader, 'reader');
      const bookStorage = storage.storageFactory!(Book, 'book');
      await readerStorage.create({ name: 'ada' });
      await bookStorage.create({ title: 'the book' });

      // Each engine holds its own table and only its own — the proof the two are
      // really two, and not one handle handed out twice.
      const inMain = (t: string) => (readerStorage.client as any)
        .selectFrom('sqlite_master').select('name').where('name', '=', t).executeTakeFirst();
      const inArchive = (t: string) => (bookStorage.client as any)
        .selectFrom('sqlite_master').select('name').where('name', '=', t).executeTakeFirst();

      expect(await inMain('readers')).toBeDefined();
      expect(await inMain('books')).toBeUndefined();
      expect(await inArchive('books')).toBeDefined();
      expect(await inArchive('readers')).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses an entity two sources claim, naming both', () => {
    expect(() => resolveStorage({ path: ':memory:' }, {
      archive: { path: ':memory:', entities: ['Book'] },
      cold: { path: ':memory:', entities: ['Book'] },
    })).toThrow(/claimed by both 'archive' and 'cold'/);
  });

  it('lets the named adapter refuse what it cannot build', () => {
    // The refusal moved to `adapter/sql`, which is the only one that knows which drivers it
    // owns — it used to live here, in the package that merely happened to import one.
    expect(() => resolveStorage({ path: ':memory:' }, {
      legacy: { dialect: 'postgres', entities: ['Book'] },
    })).toThrow(/dialect 'postgres': cannot be built from a name/);
  });

  it('refuses a source naming an adapter nothing answers, listing what does', () => {
    expect(() => resolveStorage({ path: ':memory:' }, {
      archive: { source: 'file', entities: ['Book'] },
    })).toThrow(/'file' is not answered.*answers sql/s);
  });

  it('behaves exactly as before when no source is declared', () => {
    const storage = resolveStorage({ dialect: 'sqlite', path: ':memory:' });
    expect(storage.storageFactory).toBeDefined();
    expect(storage.transacted).toBeDefined();
  });
});

describe('storageFrom — an engine the caller built', () => {
  it('places an entity on a hand-built Kysely dialect, and migrates it there', async () => {
    // The escape hatch `resolveStorage` cannot offer: a config file holds no live
    // dialect, so a name resolves to sqlite and nothing else. Here the caller brings
    // the engine — this one happens to be sqlite so the test can read it back, but
    // nothing in the routing knows or asks.
    const archive = setupKysely(
      new SqliteDialect({ database: new Database(':memory:') }),
      'sqlite',
    );
    const storage = storageFrom({
      db: setupSqlite({ path: ':memory:' }),
      sources: { archive: { source: archive, entities: ['Book'] } },
    });

    await storage.migrate!(app as never);
    const bookStorage = storage.storageFactory!(Book, 'book');
    await bookStorage.create({ title: 'brought my own engine' });

    const held = async (client: any, table: string) => client
      .selectFrom('sqlite_master').select('name').where('name', '=', table).executeTakeFirst();

    expect(await held(archive.db, 'books')).toBeDefined();
    expect(await held(archive.db, 'readers')).toBeUndefined();
    expect(await held(storage.db as any, 'readers')).toBeDefined();
    expect(await held(storage.db as any, 'books')).toBeUndefined();
  });

  it('refuses the same double claim, whoever built the engines', () => {
    const twice = () => storageFrom({
      db: setupSqlite({ path: ':memory:' }),
      sources: {
        archive: { source: setupSqlite({ path: ':memory:' }), entities: ['Book'] },
        cold: { source: setupSqlite({ path: ':memory:' }), entities: ['Book'] },
      },
    });
    expect(twice).toThrow(/claimed by both 'archive' and 'cold'/);
  });
});

/**
 * The identity map misses on an entity that IS in the batch.
 *
 * A sibling entity importing `./Reader.js` and the scan loading `Reader.ts` are two
 * module instances, so `ref(Reader)` yields a class object the map was never keyed on.
 * Measured on a real app, where the refusal fired on an entity right there in the
 * batch — which is why the three answers are decided on the NAME.
 */
describe('the same entity reached as two class objects', () => {
  it('is still recognised as hosted here, and keeps its constraint', () => {
    // A second declaration of the same entity: same name, different object — exactly
    // what two module instances produce.
    class ReaderTwin extends entity({ id: primary(), name: text() }) {}
    Object.defineProperty(ReaderTwin, 'name', { value: 'Reader' });
    class Visit extends entity({ id: primary(), readerId: ref(ReaderTwin) }) {}

    const tables = toTables({
      fronds: [
        { name: 'people', entities: [{ name: 'reader', entityClass: Reader }] },
        { name: 'visits', entities: [{ name: 'visit', entityClass: Visit }] },
      ],
      elsewhere: [],
    } as never, (name) => `${name}s`);

    expect(fkOf(tables, 'visits', 'reader_id')).toEqual({ table: 'readers', column: 'id' });
  });
});

/**
 * A derivation describes an ANSWER, not a place rows live.
 *
 * Measured on a real app: `Book.pick('id','title')` dropped under `entities/` created
 * a table of its own — and in the DEFAULT database, while `Book` itself lived in
 * another source. A projection of archived rows quietly grew a duplicate elsewhere.
 *
 * Recognised by the inheritance chain and not by where the file sits: a class extending
 * `entity({…})` carries no origin, everything derived from it carries one — an inherited
 * static, so it survives two derivations and still names the ROOT. The whole verdict
 * lives with its owner, in `adapter/sql`'s `anchor.test.ts`; what is checked here is that
 * a source's own partitioning does not reopen it.
 */
describe('a derivation', () => {
  // A CLASS, never `const Card = Book.pick(…)`: a derivation held in a const answers
  // `Schema` to `.name`, and the name is what registers it, names its table and titles
  // it on the card. Extending is what gives the shape an identity.
  class BookCard extends Book.pick('title') {}
  const withCard = {
    fronds: [
      ...app.fronds,
      { name: 'views', entities: [{ name: 'bookCard', entityClass: BookCard }] },
    ],
  };
  const named = (tables: any[]) => tables.map((t) => t.name).sort();

  it('makes no table — it is a shape, not a source', () => {
    expect(named(toTables(withCard as never, (n) => `${n}s`))).not.toContain('bookCards');
  });

  it("makes one when the ENTITY anchors — never when a source names it", () => {
    class Archive extends Book.pick('title').anchor() {}
    const withArchive = {
      fronds: [...app.fronds, { name: 'views', entities: [{ name: 'archive', entityClass: Archive }] }],
    };

    expect(named(toTables(withArchive as never, (n) => `${n}s`))).toContain('archives');
  });

  it('is recognised through the chain, not the file — a class extending one is one too', () => {
    class Deeper extends BookCard.pick('title') {}
    const deep = { fronds: [{ name: 'views', entities: [{ name: 'deeper', entityClass: Deeper }] }] };
    expect(toTables(deep as never, (n) => `${n}s`)).toHaveLength(0);
  });

  it('leaves an entity alone — it inherits from entity() directly and carries no origin', () => {
    expect(named(toTables(app as never, (n) => `${n}s`))).toEqual(['books', 'loans', 'readers']);
  });
});

