/**
 * What the shape says, held by the storage — against a real SQLite database.
 *
 * The façade already refuses a bad value a client proposes. What is tested here is
 * the other path: a handler writing straight through the ORM, which is exactly where
 * `oneOf('draft','published')` used to let `'brouillon'` land and stay.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { entity, primary, text, number, oneOf, optional, created } from '@fougere/schema';
import { autoMigrate, createTableSQL, toTable } from '../src/index.js';
import { setupSqlite, type SqliteSetup } from '../src/sqlite.js';

class Post extends entity({
  id: primary(),
  title: text({ min: 3, max: 20 }),
  status: oneOf('draft', 'published'),
  score: number({ min: 0, max: 100 }),
  note: optional(text({ max: 5 })),
  createdAt: created(),
}) {}

let setup: SqliteSetup;
let orm: any;

beforeEach(async () => {
  setup = setupSqlite({ path: ':memory:' });
  await autoMigrate({ fronds: [{ name: 'test', entities: [{ name: 'post', entityClass: Post }] }] }, setup.sqlite);
  orm = setup.ormFactory(Post, 'post');
});

const valid = { title: 'Hello', status: 'draft', score: 10 };

describe('a value the shape forbids does not land', () => {
  it('accepts what the shape allows', async () => {
    await expect(orm.create(valid)).resolves.toBeTruthy();
  });

  it('refuses a value outside oneOf — the case that used to persist in silence', async () => {
    await expect(orm.create({ ...valid, status: 'brouillon' })).rejects.toThrow();
  });

  it('refuses a string under its minimum and over its maximum', async () => {
    await expect(orm.create({ ...valid, title: 'ab' })).rejects.toThrow();
    await expect(orm.create({ ...valid, title: 'x'.repeat(21) })).rejects.toThrow();
  });

  it('refuses a number outside its bounds', async () => {
    await expect(orm.create({ ...valid, score: -1 })).rejects.toThrow();
    await expect(orm.create({ ...valid, score: 101 })).rejects.toThrow();
  });

  it('refuses on update too — the rule is not about creation', async () => {
    const post = await orm.create(valid);

    await expect(orm.update(post.id, { status: 'archivé' })).rejects.toThrow();
  });
});

describe('the bound does not swallow absence', () => {
  it('an optional column accepts null, and still bounds a value', async () => {
    await expect(orm.create({ ...valid, note: undefined })).resolves.toBeTruthy();
    await expect(orm.create({ ...valid, note: 'ok' })).resolves.toBeTruthy();
    await expect(orm.create({ ...valid, note: 'too long' })).rejects.toThrow();
  });
});

describe('what is emitted', () => {
  it('names one constraint per bounded column, and none for the unbounded', () => {
    const ddl = createTableSQL(toTable('posts', Post), 'sqlite');

    expect(ddl).toContain('posts_status_check');
    expect(ddl).toContain('posts_title_check');
    expect(ddl).toContain('posts_score_check');
    // `createdAt` bounds nothing — a constraint that constrains nothing is noise.
    expect(ddl).not.toContain('posts_created_at_check');
  });

  it('leaves pattern and format to the façade — regex dialects diverge', () => {
    class WithPattern extends entity({
      id: primary(),
      slug: text({ pattern: '^[a-z-]+$' }),
    }) {}

    expect(createTableSQL(toTable('slugs', WithPattern), 'sqlite')).not.toContain('check');
  });
});
