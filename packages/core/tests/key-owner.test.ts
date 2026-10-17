/**
 * One key, one owner — the container refuses a second registration in a scope. When a check
 * already refused the line that collides, the boot answers with that check, which names the file.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { entity, primary, text } from '@fougere/schema';
import { createApp, frond } from '../src/index.js';

class Post extends entity({ id: primary(), title: text() }) {}
class PostStorage {}

const storageFactory = () => ({}) as never;

describe('a provider named like an entity storage', () => {
  it('is answered by the check that names it, not by the container', async () => {
    await expect(createApp({
      fronds: [frond('blog', { entities: [Post], providers: [PostStorage] })],
      createContainer,
      storageFactory,
    })).rejects.toThrow(/\[storage-key-is-provider\] PostStorage/);
  });

  it('names every frond that does it, not the first', async () => {
    class Item extends entity({ id: primary(), name: text() }) {}
    class ItemStorage {}

    await expect(createApp({
      fronds: [
        frond('blog', { entities: [Post], providers: [PostStorage] }),
        frond('shop', { entities: [Item], providers: [ItemStorage] }),
      ],
      createContainer,
      storageFactory,
    })).rejects.toThrow(/2 declaration\(s\)[\s\S]*PostStorage[\s\S]*ItemStorage/);
  });

  it('boots once it is named for what it is', async () => {
    class PostArchive {}
    await using app = await createApp({
      fronds: [frond('blog', { entities: [Post], providers: [PostArchive] })],
      createContainer,
      storageFactory,
    });

    expect(app.fronds.map((one) => one.name)).toEqual(['blog']);
  });
});
