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
class PostHandler { list(): Post[] { return []; } }

describe('a host that states what it hosts', () => {
  it('boots without scanning, and serves what it stated', async () => {
    configureFougere({
      db: false,
      fronds: [frond('blog', { entities: [Post], handlers: [PostHandler] })],
    });

    const app = await useFougereApp();

    expect(app.fronds.entityNames()).toEqual(['post']);
    expect(app.fronds.servedNames()).toEqual(['post']);
  });

  it('pulls in no compiler, which is the whole point', async () => {
    // The DELTA, not the count: a test runner has its own reasons to hold `typescript`,
    // and measuring presence rather than arrival is how this assertion was wrong first.
    // `scanProject` loads the compiler lazily, so a boot that reached it moves this number.
    const modules = () => (process as unknown as { moduleLoadList: string[] }).moduleLoadList
      .filter((m) => m.includes('typescript')).length;

    const before = modules();
    configureFougere({ db: false, fronds: [frond('blog', { entities: [Post] })] });
    await useFougereApp();

    expect(modules()).toBe(before);
  });
});
