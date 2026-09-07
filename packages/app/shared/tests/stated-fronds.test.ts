/**
 * A host that states its fronds never reaches the scanner.
 *
 * Measured before this existed: exactly two places scan — the Nuxt module, at BUILD, and
 * this boot, at START. Next, Vite, React, Svelte and a bare Express have no scan of their
 * own; they all arrive here, so every one of them read a disk and loaded `typescript` in
 * production. One door, and it covers all five.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { frond } from '@fougere/core';
import { configureFougere, useFougereApp } from '../src/boot.js';

class Post extends entity({ id: primary(), title: text() }) {}
class PostHandler {
  list(): Post[] { return []; }
  publish(id: string): Post { return { id, title: '' } as Post; }
}

describe('a host that states what it hosts', () => {
  it('boots without scanning, and serves what it stated', async () => {
    configureFougere({
      fronds: [frond('blog', { entities: [Post], handlers: [PostHandler] })],
    });

    const app = await useFougereApp();

    expect(app.fronds.entityNames()).toEqual(['post']);
    expect(app.fronds.servedNames()).toEqual(['post']);
  });

  it('serves a method the scan read, which no class carries at runtime', async () => {
    // A prefab declares its own ops in a static; a method someone wrote declares nothing.
    // The scan reads it from SOURCE, so a statement that drops it leaves the route unbuilt
    // — measured on a real app, which served its five CRUD ops and not one of its own.
    configureFougere({
      fronds: [frond('blog', {
        entities: [Post],
        handlers: [{
          ctor: PostHandler,
          operations: {
            publish: {
              cardinality: 'one',
              binding: [{ name: 'id', source: { kind: 'param', name: 'id' }, optional: false }],
            },
          },
        }],
      })],
    });
    const app = await useFougereApp();

    expect(Object.keys(app.facadeFor('post') ?? {})).toContain('publish');
  });

  it('registers a provider under the name stated, not the one a bundler left', async () => {
    // esbuild lowers a `static readonly` field and renames the declaration doing it, so
    // the class arrives as `_Weather` and every handler asking for `Weather` misses. What
    // the scan read is written down; `ctor.name` answers only where nobody wrote it.
    class _Weather { static readonly SOURCE = 'https://example.org'; }

    configureFougere({
      fronds: [frond('blog', {
        entities: [Post],
        providers: [{ ctor: _Weather, name: 'Weather' }],
      })],
    });
    const app = await useFougereApp();

    expect(app.container.resolve('frond:blog')).toBeDefined();
    expect(() => (app.container.resolve('frond:blog') as { resolve(n: string): unknown }).resolve('Weather'))
      .not.toThrow();
  });

  it('pulls in no compiler, which is the whole point', async () => {
    // The DELTA, not the count: a test runner has its own reasons to hold `typescript`,
    // and measuring presence rather than arrival is how this assertion was wrong first.
    // `scanProject` loads the compiler lazily, so a boot that reached it moves this number.
    const modules = () => (process as unknown as { moduleLoadList: string[] }).moduleLoadList
      .filter((m) => m.includes('typescript')).length;

    const before = modules();
    configureFougere({ fronds: [frond('blog', { entities: [Post] })] });
    await useFougereApp();

    expect(modules()).toBe(before);
  });
});
