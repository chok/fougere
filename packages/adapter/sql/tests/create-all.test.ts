/**
 * `createAll` writes a set in one statement: every row answered whole, in the order given, and a
 * conflict on one leaves none written. Postgres runs when `FOUGERE_TEST_PG` names a database the
 * test may empty, with the driver in `FOUGERE_TEST_PG_APP`.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { sql } from 'kysely';
import { entity, number, oneOf, primary, ref, text } from '@fougere/schema';
import { ErrorCode } from '@fougere/core/contract';
import { autoMigrate, createKyselySource, toTableName, type SqlSource } from '../src/index.js';
import { createSqliteSource } from '../src/sqlite/SqliteSource.js';
import { dialectFor } from '../src/driver/Driver.js';

class Line extends entity({
  id: primary(),
  sku: text(),
  quantity: number({ integer: true, min: 1 }),
  state: oneOf('open', 'shipped', { default: 'open' }),
}) {}

class Shelf extends entity({ id: primary(), name: text() }) {}

/** Keyed by a `ref()`: its column is a uuid in the table, which the storage cannot read off the declaration alone. */
class Slot extends entity({ shelf: primary(ref(Shelf)), units: number({ integer: true, min: 0 }) }) {}

const sources: [string, () => SqlSource][] = [['sqlite', () => createSqliteSource({ path: ':memory:' })]];
const postgres = process.env.FOUGERE_TEST_PG;
if (postgres) sources.push(['pg', () => createKyselySource(dialectFor('pg', postgres, process.env.FOUGERE_TEST_PG_APP), 'pg')]);

const opened: SqlSource[] = [];
afterAll(async () => {
  for (const source of opened) await source.close?.();
});

async function lines(open: () => SqlSource) {
  const source = open();
  opened.push(source);
  await sql`drop table if exists ${sql.table(toTableName('Line'))}`.execute(source.db);
  await autoMigrate({ entities: new Map([['line', Line]]) } as never, source.sink);

  return source.storageFactory(Line as never, 'line');
}

describe.each(sources)('createAll on %s', (_, open) => {
  it('answers every row whole, in the order given, defaults filled', async () => {
    const storage = await lines(open);

    const created = await storage.createAll([{ sku: 'b', quantity: 2 }, { sku: 'a', quantity: 1 }]);

    expect(created.map((row) => [row.sku, row.quantity, row.state])).toEqual([['b', 2, 'open'], ['a', 1, 'open']]);
    expect((await storage.list()).length).toBe(2);
  });

  it('writes none of them when one conflicts', async () => {
    const storage = await lines(open);
    const [first] = await storage.createAll([{ sku: 'a', quantity: 1 }]);

    await expect(storage.createAll([{ sku: 'b', quantity: 1 }, { id: first!.id, sku: 'c', quantity: 1 }]))
      .rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    expect((await storage.list()).length).toBe(1);
  });

  it('changes a set whose rows change the same columns, keyed by a uuid', async () => {
    const storage = await lines(open);
    const [a, b] = await storage.createAll([{ sku: 'a', quantity: 1 }, { sku: 'b', quantity: 2 }]);

    const updated = await storage.updateByKeys([a!.id as string, b!.id as string], (row) => ({ quantity: (row.quantity as number) + 10 }));

    expect([...updated.values()].map((row) => [row.sku, row.quantity]).sort()).toEqual([['a', 11], ['b', 12]]);
    expect((await storage.findById(b!.id as string))?.quantity).toBe(12);
  });

  it('changes a set whose rows change different columns, one by one', async () => {
    const storage = await lines(open);
    const [a, b] = await storage.createAll([{ sku: 'a', quantity: 1 }, { sku: 'b', quantity: 1 }]);

    const updated = await storage.updateByKeys([a!.id as string, b!.id as string], (row) =>
      (row.sku === 'a' ? { quantity: 5 } : { state: 'shipped' }));

    expect(updated.get(a!.id as string)).toMatchObject({ quantity: 5, state: 'open' });
    expect(updated.get(b!.id as string)).toMatchObject({ quantity: 1, state: 'shipped' });
  });

  it('changes a set keyed by a ref() to a uuid key, in one statement', async () => {
    const shelves = await lines(open).then(() => opened.at(-1)!);
    await sql`drop table if exists ${sql.table(toTableName('Slot'))}`.execute(shelves.db);
    await sql`drop table if exists ${sql.table(toTableName('Shelf'))}`.execute(shelves.db);
    await autoMigrate({ entities: new Map<string, unknown>([['shelf', Shelf], ['slot', Slot]]) } as never, shelves.sink);
    const [left, right] = await shelves.storageFactory(Shelf as never, 'shelf').createAll([{ name: 'left' }, { name: 'right' }]);
    const slots = shelves.storageFactory(Slot as never, 'slot');
    await slots.createAll([{ shelf: left!.id, units: 5 }, { shelf: right!.id, units: 5 }]);

    const updated = await slots.updateByKeys([left!.id as string, right!.id as string], (slot) => ({ units: (slot.units as number) - 1 }));

    expect([...updated.values()].map((slot) => slot.units)).toEqual([4, 4]);
    expect(await slots.findById('missing')).toBeUndefined();
    expect(await slots.findAllBy({ shelf: 'missing' })).toEqual([]);
  });
});
