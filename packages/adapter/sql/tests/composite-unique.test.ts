/**
 * A pair that may only exist once — against a real SQLite database.
 *
 * The point of the constraint is what a handler cannot do: a check followed by a
 * write is two round trips, and a concurrent request fits between them. Only the
 * storage can refuse the second write, so only the storage is tested here.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { entity, primary, text, created } from '@fougere/schema';
import { setupSqlite, autoMigrate, toTable, type SqliteSetup } from '../src/index.js';

class ListBook extends entity(
  {
    id: primary(),
    listId: text(),
    docId: text(),
    addedAt: created(),
  },
  { unique: [['listId', 'docId']] },
) {}

let setup: SqliteSetup;
let orm: any;

beforeEach(async () => {
  setup = setupSqlite({ path: ':memory:' });
  await autoMigrate({ fronds: [{ name: 'test', entities: [{ name: 'listBook', entityClass: ListBook }] }] }, setup.sqlite);
  orm = setup.ormFactory(ListBook, 'listBook');
});

describe('composite unique', () => {
  it('the storage refuses the duplicate pair', async () => {
    await orm.create({ listId: 'l1', docId: 'd1' });

    await expect(orm.create({ listId: 'l1', docId: 'd1' })).rejects.toThrow();
  });

  it('either column alone stays free — the fact is about the pair', async () => {
    await orm.create({ listId: 'l1', docId: 'd1' });

    await expect(orm.create({ listId: 'l1', docId: 'd2' })).resolves.toBeTruthy();
    await expect(orm.create({ listId: 'l2', docId: 'd1' })).resolves.toBeTruthy();
  });

  it('an entity that declares none carries none', () => {
    class Plain extends entity({ id: primary(), name: text() }) {}

    expect(toTable('plains', Plain).uniqueGroups).toEqual([]);
  });

  it('the group is named in fields and realized in columns', () => {
    class Saved extends entity(
      { id: primary(), userId: text(), listId: text() },
      { unique: [['userId', 'listId']] },
    ) {}

    expect(toTable('saved', Saved).uniqueGroups).toEqual([['user_id', 'list_id']]);
  });

  it('a derivation that drops a member drops the group — a remnant would say more', () => {
    expect(ListBook.pick('id', 'listId').getUnique()).toBeUndefined();
    expect(ListBook.omit('docId').getUnique()).toBeUndefined();
    // Both members survive, so the fact survives.
    expect(ListBook.omit('addedAt').getUnique()).toEqual([['listId', 'docId']]);
  });

  it('rename carries the group to the new names', () => {
    expect(ListBook.rename({ docId: 'bookId' }).getUnique()).toEqual([['listId', 'bookId']]);
  });
});
