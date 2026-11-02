/**
 * A key `uuidv7` or `uuid` generates is a `uuid` column on Postgres, and so is every `ref()` to it:
 * 16 bytes where text took 36, an index half the size (measured 2026-11-02, 1 M rows). A value that
 * is no UUID designates no row rather than failing the statement. Postgres runs when
 * `FOUGERE_TEST_PG` names a database the test may empty, with the driver in `FOUGERE_TEST_PG_APP`.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { sql } from 'kysely';
import { entity, primary, ref, text } from '@fougere/schema';
import { sourceViewOf } from '@fougere/core';
import { autoMigrate, createKyselySource, pendingOf, toTableName } from '../src/index.js';
import { generateSQL } from '../src/ddl/SqlSink.js';
import { dialectFor } from '../src/driver/Driver.js';

class Ticket extends entity({ id: primary(), title: text() }) {}
class Reply extends entity({ id: primary({ generate: 'cuid2' }), ticket: ref(Ticket), body: text() }) {}
class Label extends entity({ code: primary(text()), name: text() }) {}

const view = sourceViewOf([{ entities: [
  { name: 'ticket', entityClass: Ticket },
  { name: 'reply', entityClass: Reply },
  { name: 'label', entityClass: Label },
] }]);

describe('the column a generated key gets', () => {
  it('is uuid on Postgres for a UUID generator and for a ref to one, text otherwise', () => {
    const statements = generateSQL(view, { dialect: 'pg' }).join('\n');

    expect(statements).toMatch(/"tickets" \("id" uuid not null primary key/);
    expect(statements).toMatch(/"replies" \("id" text not null primary key/);
    expect(statements).toMatch(/"ticket" uuid not null references "tickets"/);
    expect(statements).toMatch(/"labels" \("code" text not null primary key/);
  });

  it('stays text where the engine has no uuid type', () => {
    expect(generateSQL(view, { dialect: 'sqlite' }).join('\n')).not.toContain(' uuid ');
  });
});

const postgres = process.env.FOUGERE_TEST_PG;

describe.skipIf(!postgres)('a uuid column on Postgres', () => {
  const source = postgres ? createKyselySource(dialectFor('pg', postgres, process.env.FOUGERE_TEST_PG_APP), 'pg') : undefined!;

  afterAll(async () => {
    await source?.close?.();
  });

  it('answers nothing, never an engine error, for a key that is no UUID', async () => {
    for (const name of ['Reply', 'Ticket']) await sql`drop table if exists ${sql.table(toTableName(name))}`.execute(source.db);
    await autoMigrate({ entities: new Map<string, unknown>([['ticket', Ticket], ['reply', Reply]]) } as never, source.sink);
    const tickets = source.storageFactory(Ticket as never, 'ticket');
    const ticket = await tickets.create({ title: 'One' });

    expect(await tickets.findById(ticket.id as string)).toMatchObject({ title: 'One' });
    expect(await tickets.findById('missing')).toBeUndefined();
    expect([...(await tickets.findByKeys(['missing', ticket.id as string])).keys()]).toEqual([ticket.id]);
    expect(await tickets.delete('missing')).toBe(false);
    await expect(tickets.update('missing', { title: 'Two' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuses the boot where a table made before kept its key as text, naming both ways out', async () => {
    await sql`drop table if exists ${sql.table(toTableName('Reply'))}`.execute(source.db);
    await sql`drop table if exists ${sql.table(toTableName('Ticket'))}`.execute(source.db);
    await sql`create table tickets (id text primary key, title text not null)`.execute(source.db);
    const view = sourceViewOf([{ entities: [{ name: 'ticket', entityClass: Ticket }] }]);

    expect(await pendingOf(view as never, source.db, { dialect: 'pg' })).toEqual([
      "tickets.id — text, where the entity stores a uuid: convert the column, or keep the ids it holds with primary({ generate: 'cuid2' })",
    ]);
  });
});
