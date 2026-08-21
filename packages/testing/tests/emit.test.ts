/**
 * What was announced, and what a subscriber does with what arrives.
 *
 * Two gestures with opposite rules, on purpose. Watching an announcement costs nothing —
 * `Emissions.announce` hands every fact to the carrier, so a test sits in the carrier's
 * seat and adds no second dispatcher. Its dual needed nothing at all: `app.deliver` is
 * already the carrier's door.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createLocalRunner } from '@fougere/core';
import { EMPTY_INVOCATION } from '@fougere/core/contract';
import { testApp } from '../src/index.js';
import PostPublished from './fixtures-emit/fronds/blog/entities/PostPublished.js';

const root = join(import.meta.dirname, 'fixtures-emit');

describe('an announced fact', () => {
  it('is visible from the test, under its own name', async () => {
    await using app = await testApp({ root });
    const run = createLocalRunner(app);
    const post = await run({ entity: 'post', op: 'create' }, {
      ...EMPTY_INVOCATION, body: { title: 'A title' },
    }) as { id: string };

    await run({ entity: 'post', op: 'publish' }, { ...EMPTY_INVOCATION, body: { id: post.id, title: 'A title' } });

    expect(app.announced(PostPublished)).toMatchObject([{ id: post.id, title: 'A title' }]);
  });

  it('carries what its own lifecycle stamps', async () => {
    await using app = await testApp({ root });
    const run = createLocalRunner(app);
    const post = await run({ entity: 'post', op: 'create' }, {
      ...EMPTY_INVOCATION, body: { title: 'Stamped' },
    }) as { id: string };

    await run({ entity: 'post', op: 'publish' }, { ...EMPTY_INVOCATION, body: { id: post.id, title: 'Stamped' } });

    // The announcement is a fact's point of persistence, so `applyCreate` runs there —
    // `at: created()` is filled although the handler never wrote it.
    expect((app.announced(PostPublished)[0] as { at?: unknown }).at).toBeTruthy();
  });

  it('is nothing at all when no operation announced it', async () => {
    await using app = await testApp({ root });

    expect(app.announced(PostPublished)).toEqual([]);
  });
});

describe('its dual — a fact that arrives', () => {
  it('reaches the subscriber that accepted its type', async () => {
    await using app = await testApp({ root });

    // `app.deliver` is the CARRIER's door: it waits for every subscriber and rejects if
    // one refuses, which is the opposite of what announcing does — and deliberately so.
    await app.deliver('postPublished', { id: 'p1', title: 'Delivered', at: new Date().toISOString() });

    // `list` answers an array CARRYING its page metadata (`hasMore`, `total`), so the
    // rows are copied out before comparing — otherwise those properties are compared too.
    const rows = await createLocalRunner(app)({ entity: 'indexed', op: 'list' }, EMPTY_INVOCATION) as unknown[];
    expect([...rows]).toMatchObject([{ postId: 'p1', title: 'Delivered' }]);
  });

  it('is judged on arrival, and a refusal reaches the carrier', async () => {
    await using app = await testApp({ root });

    // A fact is judged strictly — a reader silently ignoring a field it should have
    // handled is worse than a loud refusal.
    await expect(app.deliver('postPublished', { id: 'p1' })).rejects.toThrow();
  });

  it('was announced in this process too, so both gestures can be watched at once', async () => {
    await using app = await testApp({ root });
    const run = createLocalRunner(app);
    const post = await run({ entity: 'post', op: 'create' }, { ...EMPTY_INVOCATION, body: { title: 'Both' } }) as { id: string };

    await run({ entity: 'post', op: 'publish' }, { ...EMPTY_INVOCATION, body: { id: post.id, title: 'Both' } });

    expect(app.announced(PostPublished)).toHaveLength(1);
    const rows = await run({ entity: 'indexed', op: 'list' }, EMPTY_INVOCATION) as unknown[];
    expect([...rows]).toHaveLength(1);
  });
});
