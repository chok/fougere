import { describe, it, expect } from 'vitest';
import { entity, primary, text, number, bool, auto, optional } from '@fougere/schema';
import { generateSQL } from '../src/index.js';

class Author extends entity({
  id: primary(),
  name: text({ min: 1 }),
  email: text(),
}) {}

class Post extends entity({
  id: primary(),
  title: text({ min: 1 }),
  views: number({ integer: true }),
  score: number(),
  active: bool({ default: true }),
  note: optional(text()),
  createdAt: auto(),
}) {}

function fakeApp(entities: { name: string; entityClass: any }[]) {
  return { fronds: [{ name: 'test', entities }] };
}

describe('generateSQL', () => {
  it('generates CREATE TABLE for a simple entity', () => {
    const app = fakeApp([{ name: 'author', entityClass: Author }]);
    const [sql] = generateSQL(app);

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS authors');
    expect(sql).toContain('id TEXT PRIMARY KEY NOT NULL');
    expect(sql).toContain('name TEXT NOT NULL');
    expect(sql).toContain('email TEXT NOT NULL');
  });

  it('maps number(integer) to INTEGER, number to REAL', () => {
    const app = fakeApp([{ name: 'post', entityClass: Post }]);
    const [sql] = generateSQL(app);

    expect(sql).toContain('views INTEGER NOT NULL');
    expect(sql).toContain('score REAL NOT NULL');
  });

  it('maps bool to INTEGER with default', () => {
    const app = fakeApp([{ name: 'post', entityClass: Post }]);
    const [sql] = generateSQL(app);

    expect(sql).toMatch(/active INTEGER.*NOT NULL.*DEFAULT true/);
  });

  it('allows nullable columns (no NOT NULL)', () => {
    const app = fakeApp([{ name: 'post', entityClass: Post }]);
    const [sql] = generateSQL(app);

    // note is optional → nullable
    const noteLine = sql.split('\n').find((l: string) => l.includes('note '));
    expect(noteLine).toBeDefined();
    expect(noteLine).not.toContain('NOT NULL');
  });

  it('generates multiple tables from multiple entities', () => {
    const app = fakeApp([
      { name: 'author', entityClass: Author },
      { name: 'post', entityClass: Post },
    ]);
    const statements = generateSQL(app);

    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('authors');
    expect(statements[1]).toContain('posts');
  });

  it('uses snake_case for column names', () => {
    const app = fakeApp([{ name: 'post', entityClass: Post }]);
    const [sql] = generateSQL(app);

    expect(sql).toContain('created_at');
    expect(sql).not.toContain('createdAt');
  });

  it('respects custom tableName option', () => {
    const app = fakeApp([{ name: 'author', entityClass: Author }]);
    const [sql] = generateSQL(app, { tableName: (name) => `app_${name}` });

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS app_author');
  });
});
