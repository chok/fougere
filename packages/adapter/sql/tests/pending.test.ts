/**
 * What a boot reads before it serves: the database against the entities, and nothing written.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { entity, primary, text, number, ref, unique } from '@fougere/schema';
import { createSqliteSource, type SqliteSource } from '../src/sqlite/SqliteSource.js';
import { desiredTables, migrate, pendingOf, undeclaredColumns } from '../src/diff/Change.js';
import { actualState } from '../src/diff/SchemaState.js';
import { planStep } from '../src/step/Plan.js';

class Author extends entity({ id: primary(), name: text() }) {}
class PostV1 extends entity({ id: primary(), body: text() }) {}
class PostV2 extends entity({ id: primary(), content: text(), views: number({ default: 0 }), slug: unique(text({ default: '' })) }) {}
class Comment extends entity({ id: primary(), authorId: ref(Author) }) {}

const appOf = (entityClass: unknown, name = 'post') => ({ fronds: [{ name: 'blog', entities: [{ name, entityClass }] }] });

let source: SqliteSource;
beforeEach(() => { source = createSqliteSource({ path: ':memory:' }); });

describe('pendingOf', () => {
  it('names a missing table, and writes nothing', async () => {
    expect(await pendingOf(appOf(PostV1) as never, source.db)).toEqual(['posts — no table']);
    expect((await actualState(source.db)).size).toBe(0);
  });

  it('names a missing column, and never an index — a name pass cannot see one', async () => {
    await migrate(appOf(PostV1) as never, source.db);

    expect(await pendingOf(appOf(PostV2) as never, source.db)).toEqual([
      'posts.content — no column', 'posts.views — no column', 'posts.slug — no column',
    ]);
  });

  it('is empty once the pass has run', async () => {
    await migrate(appOf(PostV2) as never, source.db);

    expect(await pendingOf(appOf(PostV2) as never, source.db)).toEqual([]);
  });

  it('reads a table whose key names an entity this process never saw', async () => {
    const carried = { ...appOf(Comment, 'comment'), elsewhere: [] };

    expect(await pendingOf(carried as never, source.db)).toEqual(['comments — no table']);
  });
});

describe('undeclaredColumns', () => {
  it('names a column a table keeps while it gains another — what an undeclared rename looks like', async () => {
    await migrate(appOf(PostV1) as never, source.db);
    const found = undeclaredColumns(desiredTables(appOf(PostV2) as never), await actualState(source.db));

    expect(found).toEqual([{ table: 'posts', columns: ['body'], added: ['content', 'views', 'slug'] }]);
  });
});

describe('a step against a database the additive pass has not reached', () => {
  it('skips a rename on a table that is not there — it will be created at its final shape', () => {
    const step = { entities: { post: { changes: [{ kind: 'renamed', from: 'body', to: 'content' }], ambiguous: [] } }, entitiesAdded: [], entitiesRemoved: [] };

    expect(planStep(step as never, desiredTables(appOf(PostV2) as never), { actual: new Map() }).changes).toEqual([]);
  });
});
