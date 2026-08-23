/**
 * A duplicate is an ANSWER, not a failure — against a real SQLite database.
 *
 * The engine refuses in its own words, naming a table and a constraint. That wording is
 * our schema and not the caller's business, and it used to leave as a blank
 * `Internal error` — the caller could not tell a duplicate from a crashed process.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { autoMigrate, sqliteDialect, pgDialect, mysqlDialect, mssqlDialect } from '../src/index.js';
import { ErrorCode } from '@fougere/core/contract';
import { setupSqlite, type SqliteSetup } from '../src/sqlite.js';

class Member extends entity({ id: primary(), email: text({ min: 3 }) }, { unique: [['email']] }) {}

let setup: SqliteSetup;

beforeEach(async () => {
  setup = setupSqlite({ path: ':memory:' });
  await autoMigrate({ fronds: [{ name: 't', entities: [{ name: 'Member', entityClass: Member }] }] } as never, setup.sink);
});

describe('a duplicate', () => {
  it('leaves as CONFLICT, not as an internal error', async () => {
    const orm = setup.ormFactory(Member as never, 'Member');
    await orm.create({ id: 'a', email: 'ada@x.io' });

    // `.rejects.toMatchObject` and not a try/catch: the point is the SHAPE of the refusal.
    await expect(orm.create({ id: 'b', email: 'ada@x.io' })).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
    });
  });

  it("never repeats the engine's words", async () => {
    const orm = setup.ormFactory(Member as never, 'Member');
    await orm.create({ id: 'a', email: 'ada@x.io' });

    const refused = await orm.create({ id: 'b', email: 'ada@x.io' }).catch((e) => e as Error);

    expect(refused.message).not.toMatch(/UNIQUE constraint/);
    expect(refused.message).toContain('members');
  });

  it('refuses an UPDATE onto an existing value too', async () => {
    const orm = setup.ormFactory(Member as never, 'Member');
    await orm.create({ id: 'a', email: 'ada@x.io' });
    await orm.create({ id: 'b', email: 'grace@x.io' });

    await expect(orm.update('b', { email: 'ada@x.io' })).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
    });
  });

  it('lets anything else through untouched', async () => {
    // A false negative costs an INTERNAL_ERROR where a CONFLICT was due — which is what
    // every engine answered before. Swallowing an unrelated failure would be worse.
    const orm = setup.ormFactory(Member as never, 'Member');

    await expect(orm.create({ id: 'a', email: 'ada@x.io', nope: 1 })).rejects.not.toMatchObject({
      code: ErrorCode.CONFLICT,
    });
  });
});

describe('each engine recognizes its own words', () => {
  // The wording belongs to the driver, so only a dialect can tell — the same reason
  // `maxBindings` and `upsert` live there.
  it.each([
    [sqliteDialect, new Error('UNIQUE constraint failed: members.email')],
    [pgDialect, Object.assign(new Error('duplicate key value'), { code: '23505' })],
    [mysqlDialect, new Error("ER_DUP_ENTRY: Duplicate entry 'ada@x.io' for key 'email'")],
    [mssqlDialect, new Error('Violation of UNIQUE KEY constraint (2627)')],
  ])('%#', (dialect, error) => {
    expect(dialect.isUniqueViolation(error)).toBe(true);
    expect(dialect.isUniqueViolation(new Error('disk I/O error'))).toBe(false);
  });

  it('reads through a wrapper, because Kysely and D1 each add one', () => {
    const wrapped = new Error('insert failed', { cause: new Error('UNIQUE constraint failed: members.email') });

    expect(sqliteDialect.isUniqueViolation(wrapped)).toBe(true);
  });
});
