/**
 * The consumer's copy, against what the producer serves today.
 *
 * `fougere sync` wrote it three weeks ago and the producer moved on. It still compiles —
 * the consumer's types are the old ones and consistent with themselves — so production is
 * where this is found today.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createLocalRunner, type IdentityCard } from '@fougere/core';
import { EMPTY_INVOCATION } from '@fougere/core/contract';
import { testApp, syncedRemotes, heldShapes, syncDriftOf, inSync } from '../src/index.js';

const consumer = join(import.meta.dirname, 'fixtures-synced');

/** The producer's card, asked the way a consumer asks it. */
const cardOf = async (fixture: string): Promise<IdentityCard> => {
  await using app = await testApp({ root: join(import.meta.dirname, fixture) });
  return await createLocalRunner(app)({ entity: 'rpc', op: 'discover' }, EMPTY_INVOCATION) as IdentityCard;
};

describe('what a consumer synced', () => {
  it('is read from the file `fougere sync` writes', async () => {
    const remotes = await syncedRemotes(consumer);

    expect(remotes.map((one) => one.name)).toEqual(['blog']);
    expect(remotes[0].url).toBe('http://127.0.0.1:4099');
  });

  it('is nothing at all for a project that synced nothing', async () => {
    expect(await syncedRemotes('/tmp/nowhere-at-all')).toEqual([]);
  });

  it('is rebuilt from the classes, since the card itself was not kept', async () => {
    const [blog] = await syncedRemotes(consumer);

    const held = await heldShapes(blog);

    expect([...held.keys()]).toEqual(['Post']);
  });

  it('still matches a producer that has not moved', async () => {
    const [blog] = await syncedRemotes(consumer);
    const drift = syncDriftOf(await heldShapes(blog), await cardOf('fixtures-drift-old'), 'blog');

    expect(inSync(drift), JSON.stringify(drift)).toBe(true);
  });

  it('no longer matches one that has', async () => {
    const [blog] = await syncedRemotes(consumer);
    const drift = syncDriftOf(await heldShapes(blog), await cardOf('fixtures-drift-new'), 'blog');

    expect(inSync(drift)).toBe(false);
    expect(drift.moved.flatMap((one) => one.changes.map((change) => change.kind))).toContain('reshaped');
  });
});
