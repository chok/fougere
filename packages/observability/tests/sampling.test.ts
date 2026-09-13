/**
 * What a sampling budget may not touch.
 *
 * A rate is how much a backend is worth per day, and no reading of the code answers it. What the
 * code answers is which spans it applies to: an operation that crosses a process produces the one
 * signal nothing else carries — the difference between the caller's span and the callee's IS the
 * wire cost, and neither measures it alone. Turn the rate down and that is exactly the trace a
 * naive sampler drops first.
 */
import { scanProject } from '@fougere/compiler';
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createApp, createLocalRunner } from '@fougere/core';
import type { InvocationContext } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { observability, type FinishedSpan } from '../src/index.js';

const fixturesDir = join(import.meta.dirname, 'fixtures-edge');
const empty: InvocationContext = { params: {}, query: {}, input: undefined, state: {} };

/**
 * `cart` reaches `catalog`. Whether that costs a round trip is the ONE thing that changes between
 * the two calls below — same fixture, same code, and `remotes:` alone decides.
 */
async function traced(sample: number, split = true): Promise<FinishedSpan[]> {
  const kept: FinishedSpan[] = [];
  await using app = await createApp({
    scan: await scanProject(fixturesDir),
    createContainer,
    ...(split ? { remotes: { catalog: 'http://127.0.0.1:4100' } } : {}),
    // The router asks the far side what it hosts before it routes anything, so the stand-in
    // answers a card for that one op and the value for every other.
    remoteTransport: () => (async (call) => (call.op === 'discover'
      ? { fronds: [{ name: 'catalog', doors: [{ name: 'stock', ops: [{ name: 'onHand', kind: 'query' }] }], facts: [] }] }
      : 3)),
    extensions: [observability({ sample, onSpan: (span) => kept.push(span) })],
  });

  const run = createLocalRunner(app);
  for (let nth = 0; nth < 40; nth++) await run({ entity: 'cart', op: 'servable' }, empty);

  return kept;
}

describe('a sampling budget', () => {
  it('never drops an operation whose work leaves the process', async () => {
    const spans = (await traced(0)).filter((span) => span.kind === 'operation' && span.entity === 'cart');

    expect(spans).toHaveLength(40);
    expect(spans.every((span) => span.sampled)).toBe(true);
  }, 30_000);

  /**
   * The other half, and without it the first proves nothing: the budget has to bite somewhere.
   * Same fixture, same operation — only `remotes:` is gone, so the work stays here.
   */
  it('applies to an operation whose work stays here', async () => {
    const spans = (await traced(0, false)).filter((span) => span.kind === 'operation' && span.entity === 'cart');

    expect(spans).toHaveLength(40);
    expect(spans.some((span) => span.sampled)).toBe(false);
  }, 30_000);

  it('keeps everything when nothing is asked of it', async () => {
    const spans = (await traced(1)).filter((span) => span.kind === 'operation');

    expect(spans.every((span) => span.sampled)).toBe(true);
  }, 30_000);
});
