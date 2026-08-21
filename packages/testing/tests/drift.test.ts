/**
 * The gap TypeScript cannot see.
 *
 * `fougere sync` wrote the consumer's copy three weeks ago; the producer moved on. It
 * still compiles — the consumer's types are the old ones, and they are consistent with
 * themselves. Production is where that is found today.
 *
 * The two fixtures here are the same frond at two moments: a bound that moved, an
 * operation that went away, and a required field added to a fact.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createLocalRunner, type IdentityCard } from '@fougere/core';
import { EMPTY_INVOCATION } from '@fougere/core/contract';
import { testApp, driftOf, agrees, explain } from '../src/index.js';

/** Asked the way a consumer asks: `rpc.discover`, through the door, not through an import. */
const cardOf = async (fixture: string): Promise<IdentityCard> => {
  await using app = await testApp({ root: join(import.meta.dirname, fixture) });
  return await createLocalRunner(app)({ entity: 'rpc', op: 'discover' }, EMPTY_INVOCATION) as IdentityCard;
};

describe('a card against the one it was copied from', () => {
  it('agrees with itself', async () => {
    const mine = await cardOf('fixtures-drift-old');

    expect(agrees(driftOf(mine, mine, 'blog'))).toBe(true);
  });

  it('names the operation the producer no longer serves', async () => {
    const drift = driftOf(await cardOf('fixtures-drift-old'), await cardOf('fixtures-drift-new'), 'blog');

    expect(drift.missingOps).toEqual([{ door: 'post', ops: ['publish'] }]);
  });

  it('names the bound that moved under a door still called', async () => {
    const drift = driftOf(await cardOf('fixtures-drift-old'), await cardOf('fixtures-drift-new'), 'blog');

    expect(drift.shapes.flatMap((one) => one.changes.map((change) => change.kind))).toContain('reshaped');
  });

  it('names the required field added to a fact, and the order it imposes', async () => {
    const drift = driftOf(await cardOf('fixtures-drift-old'), await cardOf('fixtures-drift-new'), 'blog');

    expect(drift.facts.map((one) => one.fact)).toContain('postPublished');
    expect(explain(drift).join('\n')).toMatch(/re-sync and deploy the readers, THEN the sender/);
  });

  it('reads as lines a deploy can act on', async () => {
    const drift = driftOf(await cardOf('fixtures-drift-old'), await cardOf('fixtures-drift-new'), 'blog');

    expect(agrees(drift)).toBe(false);
    expect(explain(drift).length).toBeGreaterThan(0);
  });
});
