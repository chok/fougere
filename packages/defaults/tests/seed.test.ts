/**
 * A seed is the frond's own code, not a client: it writes by the storage, as a handler does —
 * a field closed to callers included, and with no user to invent.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createContainer } from '@fougere/container';
import { entity, oneOf, primary, readOnly, ref, text } from '@fougere/schema';
import { createSqliteSource } from '@fougere/adapter-sql/sqlite';
import { createApp, Crud, frond, pageOf } from '@fougere/core';
import { layerOf, storageFrom } from '../src/storage/ResolvedStorage.js';

class Author extends entity({ id: primary(), name: text() }) {}
class Post extends entity({
  id: primary(),
  title: text(),
  authorId: ref(Author),
  status: readOnly(oneOf('draft', 'published', { default: 'draft' })),
}) {}
class PostHandler extends Crud(Post) {}

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('a seed', () => {
  it('writes its rows by the storage — a readOnly field and a reference by a stated id', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'seed-'));
    dirs.push(dir);
    const storage = storageFrom({ db: createSqliteSource({ path: join(dir, 'app.db') }) });

    await using app = await createApp({
      createContainer,
      ...layerOf(storage),
      fronds: [frond('blog', {
        entities: [Author, Post],
        handlers: [PostHandler],
        seeds: [
          { entityName: 'post', data: [{ title: 'Hello', authorId: 'alice', status: 'published' }] },
          { entityName: 'author', data: [{ id: 'alice', name: 'Alice' }] },
        ],
      })],
    } as never);

    const posts = pageOf(await app.storageFor('post')!.list()).items;
    expect(posts).toMatchObject([{ title: 'Hello', authorId: 'alice', status: 'published' }]);
  });
});
