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
import { entity, primary, ref, text } from '@fougere/schema';
import { toTables } from '@fougere/adapter-sql';
import { resolveStorage } from '../src/storage.js';

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
      await storage.afterBoot!(app as never);

      const readerOrm = storage.ormFactory!(Reader, 'reader');
      const bookOrm = storage.ormFactory!(Book, 'book');
      await readerOrm.create({ name: 'ada' });
      await bookOrm.create({ title: 'the book' });

      // Each engine holds its own table and only its own — the proof the two are
      // really two, and not one handle handed out twice.
      const inMain = (t: string) => (readerOrm.client as any)
        .selectFrom('sqlite_master').select('name').where('name', '=', t).executeTakeFirst();
      const inArchive = (t: string) => (bookOrm.client as any)
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

  it('refuses an engine it cannot resolve from a name, on a source as on db', () => {
    expect(() => resolveStorage({ path: ':memory:' }, {
      legacy: { dialect: 'postgres', entities: ['Book'] },
    })).toThrow(/sources\.legacy\.dialect 'postgres' cannot be resolved from its name/);
  });

  it('behaves exactly as before when no source is declared', () => {
    const storage = resolveStorage({ dialect: 'sqlite', path: ':memory:' });
    expect(storage.ormFactory).toBeDefined();
    expect(storage.dialect).toBe('sqlite');
  });
});
