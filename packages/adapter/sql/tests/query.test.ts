import { describe, expect, it } from 'vitest';
import { createSqliteSource } from '../src/sqlite/SqliteSource.js';
import { type QueryEvent } from '../src/query/QueryEvent.js';
import { onQuery } from '../src/query/QuerySink.js';

/**
 * The subscription every storage routes to.
 *
 * Kysely takes its `log` at construction and the storage is built during the boot, so this
 * is the only shape that lets a later reader — an extension's `up(app)` — hear anything.
 */
describe('onQuery', () => {
  it('reports a real statement with its cost, and names the storage', async () => {
    const seen: QueryEvent[] = [];
    const stop = onQuery((event) => seen.push(event));
    const { db, sqlite } = createSqliteSource({ path: ':memory:', name: 'probe' });

    try {
      await db.schema.createTable('crate').addColumn('id', 'text').execute();
      await db.insertInto('crate').values({ id: 'a' }).execute();
      seen.length = 0;
      await db.selectFrom('crate').selectAll().where('id', '=', 'a').execute();

      expect(seen).toHaveLength(1);
      expect(seen[0]!.sql).toMatch(/select .* from "crate"/i);
      expect(seen[0]!.storage).toBe('probe');
      expect(seen[0]!.parameters).toBe(1);
      expect(seen[0]!.failed).toBe(false);
      expect(seen[0]!.ms).toBeGreaterThanOrEqual(0);
      // Three decimals: an in-memory statement is sub-microsecond and reported 17 digits.
      expect(String(seen[0]!.ms)).toMatch(/^\d+(\.\d{1,3})?$/);
    } finally {
      stop();
      await db.destroy();
      sqlite.close();
    }
  });

  it('names what it did and what it did it to, so a reader labels it without re-reading sql', async () => {
    const seen: QueryEvent[] = [];
    const stop = onQuery((event) => seen.push(event));
    const { db, sqlite } = createSqliteSource({ path: ':memory:', name: 'probe' });

    try {
      await db.schema.createTable('crate').addColumn('id', 'text').execute();
      seen.length = 0;
      await db.insertInto('crate').values({ id: 'a' }).execute();
      await db.updateTable('crate').set({ id: 'b' }).execute();
      await db.selectFrom('crate').selectAll().execute();
      await db.deleteFrom('crate').execute();

      expect(seen.map((one) => `${one.verb} ${one.subject}`)).toEqual([
        'insert crate', 'update crate', 'select crate', 'delete crate',
      ]);
      // A statement naming no table answers for the storage that ran it, never nothing.
      seen.length = 0;
      await db.executeQuery({ sql: 'pragma user_version', parameters: [], query: { kind: 'RawNode' } } as never);
      expect(seen[0]!.subject).toBe('probe');
      expect(seen[0]!.verb).toBe('pragma');
    } finally {
      stop();
      await db.destroy();
      sqlite.close();
    }
  });

  it('carries how many parameters there were, never their values', async () => {
    const seen: QueryEvent[] = [];
    const stop = onQuery((event) => seen.push(event));
    const { db, sqlite } = createSqliteSource({ path: ':memory:' });

    try {
      await db.schema.createTable('crate').addColumn('code', 'text').execute();
      seen.length = 0;
      await db.insertInto('crate').values({ code: 'a-secret-value' }).execute();

      // The rule the call log states for a body: user data nobody chose to expose.
      expect(JSON.stringify(seen)).not.toContain('a-secret-value');
      expect(seen[0]!.parameters).toBe(1);
    } finally {
      stop();
      await db.destroy();
      sqlite.close();
    }
  });

  it('stops reporting once the subscription is released', async () => {
    const seen: QueryEvent[] = [];
    onQuery((event) => seen.push(event))();
    const { db, sqlite } = createSqliteSource({ path: ':memory:' });

    try {
      await db.schema.createTable('crate').addColumn('id', 'text').execute();
      expect(seen).toEqual([]);
    } finally {
      await db.destroy();
      sqlite.close();
    }
  });
});
