/**
 * A frozen step, realised against real tables.
 *
 * `delta()` is additive because a rename is undetectable from two states. A step is the
 * other case: a human declared the rename at `fougere freeze`, so the intention exists
 * and the data can follow it instead of being dropped and re-added.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect, sql } from 'kysely';
import { Bundle, entity, primary, text, number, optional, type Fields, type SetDiffOptions } from '@fougere/schema';
import { planStep, collapseChain, stepSQL, applyStep } from '../src/step.js';
import { desiredTables, actualState, type SchemaState } from '../src/diff.js';
import { createTableSQL } from '../src/ddl.js';

const bundle = (fields: Fields) => Bundle.fromSchemas({ post: class extends entity(fields) {} });
const between = (before: Fields, after: Fields, options: SetDiffOptions = {}) =>
  bundle(before).diff(bundle(after), options);

/** The app as it stands today — what the tables are built from. */
const appOf = (fields: Fields) => ({
  fronds: [{ name: 'blog', entities: [{ name: 'post', entityClass: class extends entity(fields) {} }] }],
});

const V1 = { id: primary(), title: text(), body: text() };

let db: Kysely<any>;

beforeEach(async () => {
  db = new Kysely<any>({ dialect: new SqliteDialect({ database: new Database(':memory:') }) });
  const [table] = desiredTables(appOf(V1));
  await sql.raw(createTableSQL(table, 'sqlite')).execute(db);
  await db.insertInto('posts').values({ id: '1', title: 'Hello', body: 'the text' }).execute();
});

describe('a rename carries the data', () => {
  it('renames the column instead of dropping and re-adding it', async () => {
    const current = { id: primary(), title: text(), content: text() };
    const step = between(V1, current, { renamed: { post: { body: 'content' } } });
    const plan = planStep(step, desiredTables(appOf(current)));

    expect(plan.refusals).toEqual([]);
    expect(plan.changes).toEqual([{ kind: 'renameColumn', table: 'posts', from: 'body', to: 'content' }]);

    await applyStep(plan, db);

    // The whole point: the row that was there still holds what it held.
    const row = await db.selectFrom('posts').selectAll().executeTakeFirst();
    expect(row).toMatchObject({ id: '1', content: 'the text' });
  });

  it('snake_cases both ends — a field is not a column', async () => {
    const before = { id: primary(), publishedAt: text() };
    const after = { id: primary(), releasedAt: text() };
    const step = between(before, after, { renamed: { post: { publishedAt: 'releasedAt' } } });

    expect(planStep(step, desiredTables(appOf(after))).changes).toEqual([
      { kind: 'renameColumn', table: 'posts', from: 'published_at', to: 'released_at' },
    ]);
  });
});

describe('a removal is realised, and only from a step', () => {
  it('drops the column the step says left', async () => {
    const current = { id: primary(), title: text() };
    const step = between(V1, current);
    const plan = planStep(step, desiredTables(appOf(current)));

    await applyStep(plan, db);

    const row = (await db.selectFrom('posts').selectAll().executeTakeFirst()) as Record<string, unknown>;
    expect('body' in row).toBe(false);
    expect(row.title).toBe('Hello');
  });
});

describe('what it will not decide alone', () => {
  it('refuses a required field with no default — existing rows have nothing to hold', () => {
    // Measured on the way here: `addColumn` applies NOT NULL only when a default exists,
    // so this used to land as a nullable column while the entity called it required.
    const current = { ...V1, authorId: text() };
    const step = between(V1, current);
    const plan = planStep(step, desiredTables(appOf(current)));

    expect(plan.changes).toEqual([]);
    expect(plan.refusals).toEqual([
      { entity: 'post', field: 'authorId', reason: expect.stringContaining('default') },
    ]);
  });

  it('says nothing when the new field declares one', () => {
    const current = { ...V1, authorId: text({ default: 'unknown' }) };
    const step = between(V1, current);

    expect(planStep(step, desiredTables(appOf(current))).refusals).toEqual([]);
  });

  it('lets an added OPTIONAL field through — the additive pass covers it', () => {
    const current = { ...V1, slug: optional(text()) };
    const step = between(V1, current);
    const plan = planStep(step, desiredTables(appOf(current)));

    expect(plan).toEqual({ changes: [], refusals: [] });
  });

  it('refuses a type change rather than inventing a conversion', () => {
    const current = { id: primary(), title: text(), body: number() };
    const step = between(V1, current);

    expect(planStep(step, desiredTables(appOf(current))).refusals[0]).toMatchObject({
      field: 'body',
      reason: expect.stringContaining('no conversion is derivable'),
    });
  });

  it('reports every refusal in one run, not the first', () => {
    const current = { id: primary(), title: number(), body: text(), authorId: text() };
    const step = between(V1, current);

    expect(planStep(step, desiredTables(appOf(current))).refusals).toHaveLength(2);
  });

  it('runs nothing at all when anything is refused', async () => {
    // Half a rename is worse than none: the plan is read whole or not at all.
    const current = { id: primary(), title: text(), content: number() };
    const step = between(V1, current, { renamed: { post: { body: 'content' } } });
    const plan = planStep(step, desiredTables(appOf(current)));

    await expect(applyStep(plan, db)).rejects.toThrow(/cannot be realised/);

    // …and the column it would have renamed is untouched.
    const row = (await db.selectFrom('posts').selectAll().executeTakeFirst()) as Record<string, unknown>;
    expect(row.body).toBe('the text');
  });
});

describe('the statement itself', () => {
  it('is one per change', () => {
    expect(stepSQL({ kind: 'renameColumn', table: 'posts', from: 'body', to: 'content' }))
      .toMatch(/alter table .*posts.* rename column .*body.* to .*content/i);
    expect(stepSQL({ kind: 'dropColumn', table: 'posts', column: 'body' }))
      .toMatch(/alter table .*posts.* drop column .*body/i);
  });
});

describe('replaying a step changes nothing', () => {
  it('skips what the columns show has already happened', async () => {
    const current = { id: primary(), title: text(), content: text() };
    const step = between(V1, current, { renamed: { post: { body: 'content' } } });
    const tables = desiredTables(appOf(current));

    await applyStep(planStep(step, tables), db);

    // Same step, second run. Idempotence by OBSERVATION: the plan reads the live columns
    // rather than a ledger of what it believes it did.
    const again = planStep(step, tables, { actual: await actualState(db) });
    expect(again.changes).toEqual([]);
    expect(await applyStep(again, db)).toEqual([]);

    const row = await db.selectFrom('posts').selectAll().executeTakeFirst();
    expect(row).toMatchObject({ content: 'the text' });
  });

  it('still proposes the half that has not run', async () => {
    const current = { id: primary(), content: text() };
    const step = between(V1, current, { renamed: { post: { body: 'content' } } });

    // Rename by hand, leave the drop undone — the state a run interrupted halfway leaves.
    await sql.raw('alter table "posts" rename column "body" to "content"').execute(db);

    expect(planStep(step, desiredTables(appOf(current)), { actual: await actualState(db) }).changes)
      .toEqual([{ kind: 'dropColumn', table: 'posts', column: 'title' }]);
  });
});

describe('a chain composes before it is planned', () => {
  const chain = (...pairs: [string, string][]) => {
    let was = V1 as Fields;
    return pairs.map(([from, to]) => {
      const now = Object.fromEntries(Object.entries(was).map(([key, f]) => [key === from ? to : key, f])) as Fields;
      const step = between(was, now, { renamed: { post: { [from]: to } } });
      was = now;
      return step;
    });
  };

  it('follows a field renamed twice to the name it ends on', () => {
    const steps = collapseChain(chain(['body', 'content'], ['content', 'richText']));
    const current = { id: primary(), title: text(), richText: text() };

    expect(planStep(steps, desiredTables(appOf(current))).changes).toEqual([
      { kind: 'renameColumn', table: 'posts', from: 'body', to: 'rich_text' },
    ]);
  });

  it('proposes nothing once the database ends on that name', () => {
    const steps = collapseChain(chain(['body', 'content'], ['content', 'richText']));
    const current = { id: primary(), title: text(), richText: text() };
    const actual: SchemaState = new Map([['posts', new Set(['id', 'title', 'rich_text'])]]);

    expect(planStep(steps, desiredTables(appOf(current)), { actual }).changes).toEqual([]);
  });

  it('cancels a rename that comes back to the name it left', () => {
    const steps = collapseChain(chain(['body', 'content'], ['content', 'body']));
    const actual: SchemaState = new Map([['posts', new Set(['id', 'title', 'body'])]]);

    expect(planStep(steps, desiredTables(appOf(V1)), { actual }).changes).toEqual([]);
  });

  it('drops the column under the name the tables hold it by', () => {
    const [renaming] = chain(['body', 'content']);
    const gone = between(
      { id: primary(), title: text(), content: text() },
      { id: primary(), title: text() },
    );

    const plan = planStep(collapseChain([renaming, gone]), desiredTables(appOf({ id: primary(), title: text() })));
    expect(plan.changes).toEqual([{ kind: 'dropColumn', table: 'posts', column: 'body' }]);
  });
});
