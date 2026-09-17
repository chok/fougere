/**
 * What an upsert says to MySQL, compiled and never run: no test here opens a MySQL server, and
 * `on duplicate key update` is the one clause SQLite cannot stand in for.
 */
import { describe, it, expect } from 'vitest';
import { DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from 'kysely';
import { entity, primary, text, number, optional, created, updated } from '@fougere/schema';
import { SqlStorage } from '../src/crud/SqlStorage.js';

class Page extends entity({
  id: primary(),
  title: text(),
  views: number({ integer: true, default: 0 }),
  createdAt: created(),
  updatedAt: updated(),
}) {}

class Tag extends entity({ id: primary(), label: optional(text()) }) {}

function mysql(schema: typeof Page | typeof Tag, table: string) {
  const statements: string[] = [];
  const db = new Kysely<any>({
    dialect: {
      createAdapter: () => new MysqlAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (kysely) => new MysqlIntrospector(kysely),
      createQueryCompiler: () => new MysqlQueryCompiler(),
    },
    log: (event) => {
      if (event.level === 'query') statements.push(event.query.sql);
    },
  });

  return { storage: new SqlStorage(db, schema, table, undefined, 'mysql'), statements };
}

const updatedBy = (statement: string) => statement.split(' on duplicate key update ')[1];

describe('an upsert on MySQL', () => {
  it('updates what the write names, and leaves the defaults and the creation stamp out', async () => {
    const { storage, statements } = mysql(Page, 'pages');
    await storage.upsert({ id: 'p1', title: 'B' });

    expect(updatedBy(statements[0]!)).toBe('`id` = ?, `title` = ?, `updated_at` = ?');
  });

  it('reads each row of a page from VALUES(), which is how MySQL names the row it refused', async () => {
    const { storage, statements } = mysql(Page, 'pages');
    await storage.upsertAll([{ id: 'p1', title: 'A' }, { id: 'p2', title: 'B' }]);

    expect(updatedBy(statements[0]!)).toBe('`id` = values(`id`), `title` = values(`title`), `updated_at` = values(`updated_at`)');
  });

  it('still says something when the write replaces no column', async () => {
    const { storage, statements } = mysql(Tag, 'tags');
    await storage.upsert({});

    expect(updatedBy(statements[0]!)).toBe('`id` = `id`');
  });
});
