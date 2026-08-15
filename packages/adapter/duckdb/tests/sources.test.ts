/**
 * A query that crosses two sources — the thing the by-key path cannot do.
 *
 * `findByKeys` enriches a page; it never selects one. Filtering, sorting or counting
 * on the other side means reading that side whole, which is the failure this exists to
 * remove. Everything below runs against two real SQLite files.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { entity, primary, text, number, ref } from '@fougere/schema';
import { connectSources, type Sources } from '../src/index.js';

class Book extends entity({ id: primary(), title: text(), language: text() }) {}
class Loan extends entity({ id: primary(), bookId: ref(Book), reader: text() }) {}

/** The answer's shape — no table, no identity: it describes a result. */
class LoansByLanguage extends entity({ language: text(), loans: number({ integer: true }) }) {}

let dir: string;
let sources: Sources;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'fougere-duck-'));

  const main = new Database(join(dir, 'main.db'));
  main.exec(`create table loans(id text primary key, book_id text, reader text)`);
  const loan = main.prepare('insert into loans values (?,?,?)');
  main.transaction(() => {
    for (let i = 0; i < 300; i++) loan.run(`l${i}`, `b${i % 40}`, `r${i % 7}`);
  })();
  main.close();

  const archive = new Database(join(dir, 'archive.db'));
  archive.exec(`create table books(id text primary key, title text, language text)`);
  const book = archive.prepare('insert into books values (?,?,?)');
  archive.transaction(() => {
    for (let i = 0; i < 40; i++) book.run(`b${i}`, `titre ${i}`, i % 2 ? 'fr' : 'en');
  })();
  archive.close();

  sources = await connectSources({
    db: { path: join(dir, 'main.db') },
    sources: { archive: { path: join(dir, 'archive.db'), entities: ['Book'] } },
    reads: [Loan, Book],
  });
});

afterAll(async () => {
  await sources?.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('a query across two sources', () => {
  it('groups by a column of the OTHER source — what by-key cannot do', async () => {
    const rows = await sources.read(LoansByLanguage)`
      select b.language, count(*) as loans
      from ${Loan} l join ${Book} b on b.id = l.book_id
      group by b.language
      order by b.language`;

    expect(rows).toEqual([
      { language: 'en', loans: 150 },
      { language: 'fr', loans: 150 },
    ]);
    // `count(*)` is a BigInt off the driver, and the shape says integer.
    expect(typeof rows[0]!.loans).toBe('number');
  });

  it('filters and sorts on the other side, and pages there', async () => {
    class Row extends entity({ id: primary(), title: text() }) {}
    const rows = await sources.read(Row)`
      select l.id, b.title
      from ${Loan} l join ${Book} b on b.id = l.book_id
      where b.language = 'fr'
      order by b.title desc
      limit 3`;

    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.title.startsWith('titre '))).toBe(true);
  });

  it('attaches only what the scope reads', () => {
    expect([...sources.attached.keys()].sort()).toEqual(['archive', 'db']);
  });
});

describe('what the query may name', () => {
  it('refuses an entity outside `reads` — its table is not in this connection', async () => {
    class Elsewhere extends entity({ id: primary() }) {}
    class Row extends entity({ id: primary() }) {}
    await expect(sources.read(Row)`select id from ${Elsewhere}`)
      .rejects.toThrow(/Elsewhere is named in a query but not in `reads`/);
  });

  it('refuses a plain value — this tag substitutes entities, not parameters', async () => {
    class Row extends entity({ id: primary() }) {}
    await expect(sources.read(Row)`select id from ${Loan} where reader = ${'r1'}`)
      .rejects.toThrow(/only an entity may be interpolated/);
  });
});

describe('the declared shape is the fence', () => {
  it('drops a column it does not name — a `select *` never leaks past it', async () => {
    class OnlyId extends entity({ id: primary() }) {}
    const [row] = await sources.read(OnlyId)`select * from ${Loan} limit 1`;

    expect(Object.keys(row!)).toEqual(['id']);
    expect(row).not.toHaveProperty('reader');
  });

  it('refuses when the query and the shape disagree, showing both', async () => {
    class Mismatched extends entity({ id: primary(), titre: text() }) {}
    await expect(sources.read(Mismatched)`select l.id, l.reader from ${Loan} l limit 1`)
      .rejects.toThrow(/declares `titre`, and the query answers `id`, `reader`/);
  });

  it('maps a snake_case column onto the field that declares it', async () => {
    class WithFk extends entity({ id: primary(), bookId: text() }) {}
    const [row] = await sources.read(WithFk)`select id, book_id from ${Loan} limit 1`;
    expect(row!.bookId).toMatch(/^b\d+$/);
  });
});

describe('a source DuckDB cannot attach', () => {
  it('is refused by name, and says what to do instead', async () => {
    await expect(connectSources({
      db: { path: ':memory:' },
      sources: { legacy: { attach: 'Server=x;', type: 'mssql' as never, entities: ['Book'] } },
      reads: [Book],
    })).rejects.toThrow(/DuckDB cannot attach — there is no such extension/);
  });
});
