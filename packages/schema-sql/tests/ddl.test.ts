import { describe, it, expect } from 'vitest';
import { entity, primary, text, number, bool, auto, optional, many, reconstruct } from '@fougere/schema';
import { createTableSQL, generateSQL, toTable } from '../src/index.js';

// ─── Fixtures ──────────────────────────────────────

class Author extends entity({
  id: primary(),
  name: text({ min: 1 }),
  email: text(),
  posts: many(() => Post),
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

class Membership extends entity({
  userId: primary(),
  groupId: primary(),
  role: text(),
}) {}

const fakeApp = (entities: { name: string; entityClass: any }[]) => ({
  fronds: [{ name: 'test', entities }],
});

const ddl = (name: string, e: any, dialect: any = 'sqlite') => createTableSQL(toTable(name, e), dialect);

// ─── Parity with the previous generator ────────────

describe('createTableSQL — sqlite parity', () => {
  it('creates the table with its columns', () => {
    const sql = ddl('authors', Author);
    expect(sql).toContain('create table if not exists "authors"');
    expect(sql).toContain('"id" text not null primary key');
    expect(sql).toContain('"name" text not null');
    expect(sql).toContain('"email" text not null');
  });

  it('maps number(integer) to integer, number to real', () => {
    const sql = ddl('posts', Post);
    expect(sql).toContain('"views" integer not null');
    expect(sql).toContain('"score" real not null');
  });

  it('maps bool to integer, carrying its default', () => {
    expect(ddl('posts', Post)).toContain('"active" integer default true not null');
  });

  it('leaves a nullable column without not null', () => {
    const sql = ddl('posts', Post);
    expect(sql).toMatch(/"note" text[,)]/);
  });

  it('names columns in snake_case', () => {
    const sql = ddl('posts', Post);
    expect(sql).toContain('"created_at"');
    expect(sql).not.toContain('createdAt');
  });

  it('drops a many relation', () => {
    expect(ddl('authors', Author)).not.toContain('"posts"');
  });

  it('emits a table constraint for a composite key', () => {
    const sql = ddl('memberships', Membership);
    expect(sql).toContain('constraint "memberships_pk" primary key ("user_id", "group_id")');
    expect(sql).not.toMatch(/"user_id"[^,]*primary key,/);
  });
});

// ─── Dialects ──────────────────────────────────────

describe('createTableSQL — across dialects', () => {
  it('picks each engine type for the same entity', () => {
    expect(ddl('posts', Post, 'pg')).toContain('"score" double precision not null');
    expect(ddl('posts', Post, 'mysql')).toContain('`score` double not null');
    expect(ddl('posts', Post, 'mssql')).toContain('"score" float not null');
  });

  it('quotes identifiers the way each engine does', () => {
    expect(ddl('posts', Post, 'mysql')).toContain('`posts`');
    expect(ddl('posts', Post, 'pg')).toContain('"posts"');
  });

  it('narrows the key column where text is not indexable', () => {
    expect(ddl('posts', Post, 'mysql')).toContain('`id` varchar(255) not null primary key');
    expect(ddl('posts', Post, 'mssql')).toContain('"id" nvarchar(255) not null primary key');
    expect(ddl('posts', Post, 'pg')).toContain('"id" text not null primary key');
  });

  it('omits if not exists on SQL Server, which has no such clause', () => {
    expect(ddl('posts', Post, 'mssql')).toMatch(/^create table "posts"/);
    expect(ddl('posts', Post, 'pg')).toMatch(/^create table if not exists/);
  });
});

// ─── generateSQL ───────────────────────────────────

describe('generateSQL', () => {
  it('emits one statement per entity', () => {
    const statements = generateSQL(fakeApp([
      { name: 'author', entityClass: Author },
      { name: 'post', entityClass: Post },
    ]));
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('"authors"');
    expect(statements[1]).toContain('"posts"');
  });

  it('respects a custom tableName', () => {
    const [sql] = generateSQL(fakeApp([{ name: 'author', entityClass: Author }]), {
      tableName: (name) => `app_${name}`,
    });
    expect(sql).toContain('create table if not exists "app_author"');
  });

  it('includes auth runtime entities', () => {
    const app = { ...fakeApp([]), auth: { entities: { user: Author } } };
    expect(generateSQL(app)[0]).toContain('"users"');
  });

  it('targets the requested dialect', () => {
    const [sql] = generateSQL(fakeApp([{ name: 'post', entityClass: Post }]), { dialect: 'pg' });
    expect(sql).toContain('double precision');
  });
});

// ─── Language independence ─────────────────────────

describe('a card is enough', () => {
  // The very card the Rust frond serves on rpc.discover — no TS entity exists.
  const card = {
    title: 'sensor',
    type: 'object' as const,
    properties: {
      id: { type: 'string', format: 'uuid', 'x-fougere': { role: { primary: true } } },
      label: { type: 'string', minLength: 2, maxLength: 40 },
      celsius: { type: 'number', minimum: -80, maximum: 80 },
      recordedAt: { type: 'string', format: 'date-time', 'x-fougere': { lifecycle: { create: 'now' } } },
    },
    required: ['label', 'celsius'],
    'x-fougere-version': 1 as const,
    'x-fougere-vendor': 'fougere' as const,
  };

  it('generates DDL from a foreign schema, with no entity class', () => {
    const Sensor = reconstruct(card as any);
    expect(ddl('sensors', Sensor, 'pg')).toContain('"celsius" double precision not null');
    expect(ddl('sensors', Sensor, 'mssql')).toContain('"id" nvarchar(255) not null primary key');
    expect(ddl('sensors', Sensor, 'sqlite')).toContain('"recorded_at" text not null');
  });
});
