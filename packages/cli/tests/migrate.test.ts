/**
 * `fougere migrate` — the one place a schema is written. The boot only reads it now, so a
 * database the entities moved ahead of is brought up here, and nowhere else.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { access, cp, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSqliteSource } from '@fougere/adapter-sql/sqlite';
import { entity, primary, text } from '@fougere/schema';
import FreezeHandler from '../fronds/analysis/handlers/FreezeHandler.js';
import MigrateHandler from '../fronds/analysis/handlers/MigrateHandler.js';
import ProjectScan from '../fronds/analysis/services/ProjectScan.js';
import { shapesOf } from '../fronds/analysis/versions.js';

const fixture = join(import.meta.dirname, 'fixtures-migrate');
let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'fougere-migrate-'));
  await cp(fixture, root, { recursive: true });
});

const migrate = (apply = false, latest = true) => new MigrateHandler(new ProjectScan()).execute({ root, apply, latest });

const shared = (apply = false) => migrate(apply, false);

const freeze = (version: string) => new FreezeHandler(new ProjectScan()).execute({ version, root });

/** A v1 cut from yesterday's entity — written by hand, since a module is imported once per process. */
const frozenYesterday = async () => {
  const Post = class Post extends entity({ id: primary(), body: text() }) {};
  const directory = join(root, 'fronds/blog/versions/v1');
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'shape.json'), JSON.stringify(shapesOf([{ name: 'Post', entityClass: Post }])));
};

const entityNow = (source: string) => writeFile(join(root, 'fronds/blog/entities/Post.ts'), source);

const rows = async () => {
  const db = createSqliteSource({ path: join(root, 'app.db') });
  try {
    return db.sqlite.prepare('select * from posts').all();
  } finally {
    await db.close?.();
  }
};

/** The table the fixture's entity made, with a row in it — written by hand, since a module is imported once per process. */
const tableOfYesterday = async () => {
  const db = createSqliteSource({ path: join(root, 'app.db') });
  db.sqlite.exec("create table posts (id text primary key, body text not null); insert into posts values ('p1', 'hello')");
  await db.close?.();
};

describe('fougere migrate', () => {
  it('prints what it would create, and creates nothing until --apply', async () => {
    const plan = await migrate();

    expect(plan.added).toEqual(['posts — no table']);
    expect(plan.ran).toEqual([]);
    expect(await migrate().then((again) => again.added)).toEqual(['posts — no table']);
  });

  it('creates the tables with --apply, and answers up to date the second time', async () => {
    await migrate(true);
    const again = await migrate();

    expect(again.added).toEqual([]);
    expect(again.changes).toEqual([]);
  });

  it('renames the column a field declares it was, and the rows follow — no freeze needed', async () => {
    await tableOfYesterday();
    await entityNow(`import { entity, primary, text } from '@fougere/schema';
export default class Post extends entity({ id: primary(), content: text() }, { previous: { content: 'body' } }) {}
`);
    const plan = await migrate(true);

    expect(plan.changes).toEqual([{ kind: 'renameColumn', table: 'posts', from: 'body', to: 'content' }]);
    expect(plan.added).toEqual([]);
    expect(await rows()).toEqual([{ id: 'p1', content: 'hello' }]);
  });

  it('warns when a table keeps a column no field declares while it gains one', async () => {
    await tableOfYesterday();
    await entityNow(`import { entity, primary, text } from '@fougere/schema';
export default class Post extends entity({ id: primary(), content: text() }) {}
`);
    const plan = await migrate();

    expect(plan.added).toEqual(['posts.content — no column']);
    expect(plan.warnings).toEqual([
      "posts keeps body, which no field declares, while content is added — if one replaces the other, declare it on the entity: previous: { content: 'body' }",
    ]);
  });
});

describe('fougere migrate, without --latest — what was frozen', () => {
  it('refuses a frond never frozen, before any database is opened', async () => {
    const plan = await shared(true);

    expect(plan.refusals).toEqual([
      { entity: 'blog', field: '*', reason: 'never frozen — fougere freeze v1, or migrate --latest on a local database' },
    ]);
    expect(plan.ran).toEqual([]);
    await expect(access(join(root, 'app.db'))).rejects.toThrow();
  });

  it('creates the tables once the entities are a frozen version', async () => {
    await freeze('v1');
    const plan = await shared(true);

    expect(plan.refusals).toEqual([]);
    expect(plan.ran).toEqual(['posts — no table']);
  });

  it('refuses an entity that moved since its last version, and --latest still follows it', async () => {
    await frozenYesterday();
    await entityNow(`import { entity, primary, text } from '@fougere/schema';
export default class Post extends entity({ id: primary(), body: text(), title: text() }) {}
`);

    expect((await shared(true)).refusals).toEqual([
      { entity: 'post', field: '*', reason: 'changed since v1 — freeze it (fougere freeze <version>), or migrate --latest on a local database' },
    ]);
    expect((await migrate(true)).ran).toEqual(['posts — no table']);
  });

  it('applies a rename frozen as v2, and the rows follow', async () => {
    await tableOfYesterday();
    await frozenYesterday();
    await entityNow(`import { entity, primary, text } from '@fougere/schema';
export default class Post extends entity({ id: primary(), content: text() }, { previous: { content: 'body' } }) {}
`);
    await freeze('v2');
    const plan = await shared(true);

    expect(plan.chain).toEqual(['v2']);
    expect(plan.changes).toEqual([{ kind: 'renameColumn', table: 'posts', from: 'body', to: 'content' }]);
    expect(await rows()).toEqual([{ id: 'p1', content: 'hello' }]);
  });
});
