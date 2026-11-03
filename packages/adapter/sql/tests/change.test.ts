/**
 * Twenty buyers, ten units: a row computed from the one it replaces is read and written with no
 * other write in between, so exactly ten sales land. Postgres runs when `FOUGERE_TEST_PG` names a
 * database the test may empty, with the driver installed in `FOUGERE_TEST_PG_APP`.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { entity, number, primary, text } from '@fougere/schema';
import { ErrorCode, FougereError } from '@fougere/core/contract';
import { sql } from 'kysely';
import { autoMigrate, createKyselySource, toTableName, type SqlSource } from '../src/index.js';
import { createSqliteSource } from '../src/sqlite/SqliteSource.js';
import { dialectFor } from '../src/driver/Driver.js';

class Stock extends entity({
  sku: primary(text()),
  units: number({ integer: true, min: 0 }),
}) {}

const sources: [string, () => Promise<SqlSource>][] = [
  ['sqlite', async () => createSqliteSource({ path: ':memory:' })],
];

const postgres = process.env.FOUGERE_TEST_PG;
if (postgres) sources.push(['pg', async () => createKyselySource(dialectFor('pg', postgres, process.env.FOUGERE_TEST_PG_APP), 'pg')]);

const opened: SqlSource[] = [];

afterAll(async () => {
  for (const source of opened) await source.close?.();
});

async function stocked(open: () => Promise<SqlSource>, units: number) {
  const source = await open();
  opened.push(source);
  await sql`drop table if exists ${sql.table(toTableName('Stock'))}`.execute(source.db);
  await autoMigrate({ entities: new Map([['Stock', Stock]]) } as never, source.sink);
  const storage = source.storageFactory(Stock as never, 'Stock');
  await storage.create({ sku: 'widget', units });

  return { source, storage };
}

const sell = (current: Record<string, unknown>) => {
  const units = current.units as number;
  if (units < 1) throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Insufficient stock' });

  return { units: units - 1 };
};

describe.each(sources)('update(id, change) on %s', (_, open) => {
  it('sells ten units to twenty buyers, ten times', async () => {
    const { storage } = await stocked(open, 10);

    const replies = await Promise.allSettled(Array.from({ length: 20 }, () => storage.update('widget', sell)));

    expect(replies.filter((reply) => reply.status === 'fulfilled')).toHaveLength(10);
    expect(replies.filter((reply) => reply.status === 'rejected' && reply.reason.code === ErrorCode.CONFLICT)).toHaveLength(10);
    expect(await storage.findById('widget')).toEqual({ sku: 'widget', units: 0 });
  });

  it('holds the row inside a transaction the caller opened', async () => {
    const { source } = await stocked(open, 10);

    await Promise.allSettled(Array.from({ length: 20 }, () =>
      source.transacted(async (factory) => factory(Stock as never, 'Stock').update('widget', sell))));

    expect(await source.storageFactory(Stock as never, 'Stock').findById('widget')).toEqual({ sku: 'widget', units: 0 });
  });

  it('answers CONFLICT, never an internal error, when two transactions take two rows in opposite orders', async () => {
    const { source, storage } = await stocked(open, 10);
    await storage.create({ sku: 'gadget', units: 10 });
    const slow = async (current: Record<string, unknown>) => {
      await new Promise((resolve) => setTimeout(resolve, 50));

      return sell(current);
    };
    const both = (first: string, second: string) => source.transacted(async (factory) => {
      const rows = factory(Stock as never, 'Stock');
      await rows.update(first, slow);
      await rows.update(second, sell);
    });

    const replies = await Promise.allSettled([both('widget', 'gadget'), both('gadget', 'widget')]);

    for (const reply of replies) {
      if (reply.status === 'rejected') expect(reply.reason).toMatchObject({ code: ErrorCode.CONFLICT });
    }
  });

  it('holds a set of rows at once, in key order, so buyers taking them in opposite orders never cross', async () => {
    const { storage } = await stocked(open, 10);
    await storage.create({ sku: 'gadget', units: 10 });
    const both = (keys: string[]) => storage.updateByKeys(keys, sell);

    const replies = await Promise.allSettled(
      Array.from({ length: 20 }, (_, index) => both(index % 2 ? ['widget', 'gadget'] : ['gadget', 'widget'])),
    );

    expect(replies.filter((reply) => reply.status === 'fulfilled')).toHaveLength(10);
    expect(replies.every((reply) => reply.status === 'fulfilled' || reply.reason.message === 'Insufficient stock')).toBe(true);
    expect(await storage.findByKeys(['widget', 'gadget'])).toEqual(new Map([
      ['widget', { sku: 'widget', units: 0 }],
      ['gadget', { sku: 'gadget', units: 0 }],
    ]));
  });

  it('refuses the whole set when one key has no row, and writes none of it', async () => {
    const { storage } = await stocked(open, 10);

    await expect(storage.updateByKeys(['widget', 'nothing'], sell)).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    expect(await storage.findById('widget')).toEqual({ sku: 'widget', units: 10 });
  });

  it('lets a transaction change a row it already holds again, while others wait for it', async () => {
    const { source } = await stocked(open, 20);
    const twice = () => source.transacted(async (factory) => {
      const rows = factory(Stock as never, 'Stock');
      await rows.update('widget', sell);
      await rows.updateByKeys(['widget'], sell);
    });

    await Promise.all(Array.from({ length: 5 }, twice));

    expect(await source.storageFactory(Stock as never, 'Stock').findById('widget')).toEqual({ sku: 'widget', units: 10 });
  });

  it('answers NOT_FOUND for a row that is not there', async () => {
    const { storage } = await stocked(open, 1);

    await expect(storage.update('nothing', sell)).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });
});
