/**
 * A primary key crosses to the column like every other value.
 *
 * `whereAll` says it in its own comment — "a filter compares against the COLUMN, so its
 * value crosses the same way a write does" — and `wherePk` did not do it. Invisible
 * while every generated key was a string; reachable the day a key holds a value the
 * driver cannot bind.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { entity, primary, created, text } from '@fougere/schema';
import { autoMigrate } from '../src/index.js';
import { setupSqlite } from '../src/sqlite.js';

class Reading extends entity({
  // A timestamp AS the key: legal, and the value the entity declares is a Date.
  at: primary(created()),
  note: text(),
}) {}

const appOf = () => ({ fronds: [{ entities: [{ name: 'reading', entityClass: Reading }] }] });

describe('a Date primary key survives the round trip', () => {
  let storage: any;

  beforeEach(async () => {
    const setup = setupSqlite({ path: ':memory:' });
    autoMigrate(appOf() as never, setup.sqlite);
    storage = setup.storageFactory(Reading as never, 'reading');
  });

  it('reads back the row it just wrote', async () => {
    const created = await storage.create({ note: 'first' });

    // The insert encoded the Date to its ISO form; the read has to do the same, or the
    // driver is handed a Date it cannot bind — after the row is already persisted.
    expect(await storage.findById(created.at)).toEqual(created);
  });

  it('accepts the domain value from a caller too', async () => {
    const created = await storage.create({ note: 'second' });
    expect(await storage.findById(new Date(created.at))).toEqual(created);
  });
});
