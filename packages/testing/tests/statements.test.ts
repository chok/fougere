/**
 * What a call cost the database, counted.
 *
 * `PostPresenter` in `demos/nuxt-blog` carries the reason in a comment: "the row-at-a-time
 * form made twenty posts twenty queries, and nothing about the code said so". This is the
 * thing that says so — and it is a number, so a test can refuse it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { createLocalRunner, Invocation, type App } from '@fougere/core';
import { spansOf, statementsOf, testApp } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-statements');
let app: App;
let call: ReturnType<typeof createLocalRunner>;

beforeAll(async () => {
  app = await testApp({ root });
  call = createLocalRunner(app);
  for (const name of ['first', 'second', 'third']) {
    await call({ entity: 'item', op: 'add' }, { ...Invocation.empty, input: { name } });
  }
}, 30_000);

afterAll(async () => { await app?.dispose(); });

describe('statementsOf', () => {
  it('counts one statement for a page', async () => {
    const ran = await statementsOf(() => call({ entity: 'item', op: 'list' }, Invocation.empty));

    expect(ran).toHaveLength(1);
    expect(ran[0].verb).toBe('select');
    expect(ran[0].subject).toBe('items');
  });

  it('counts the reads a row-at-a-time answer makes', async () => {
    const ran = await statementsOf(() => call({ entity: 'item', op: 'listOneByOne' }, Invocation.empty));

    // The page, then one read per row it already held. Three rows here; in production it is
    // however many the page returned, which is what makes it invisible until it is counted.
    expect(ran).toHaveLength(4);
    expect(ran.every((one) => one.verb === 'select')).toBe(true);
  });

  it('stops counting when the block ends, refusal included', async () => {
    await expect(statementsOf(() => Promise.reject(new Error('refused')))).rejects.toThrow('refused');

    const after = await statementsOf(() => call({ entity: 'item', op: 'list' }, Invocation.empty));
    expect(after).toHaveLength(1);
  });
});

describe('spansOf', () => {
  it('takes out of the op exactly what ran under it', async () => {
    const spans = await spansOf(app, () => call({ entity: 'item', op: 'listOneByOne' }, Invocation.empty));
    const [op] = spans.filter((span) => span.kind === 'operation');
    const under = spans.filter((span) => span.kind === 'statement');

    expect(op.statements).toBe(under.length);
    expect(op.ms - op.selfMs).toBeCloseTo(under.reduce((sum, one) => sum + one.ms, 0), 5);
  });

  /**
   * What the figure is FOR: `expect(op.selfMs).toBeLessThan(0.1 * op.ms)` states that an op
   * delegates rather than works, and a ratio survives a slow machine where a threshold in
   * milliseconds does not. Asserted here as the share it actually is, because on SQLite
   * in-memory the four reads are 16 % of the call — the façade costs more than the engine,
   * which is the kind of thing a duration alone never says.
   */
  it('separates what the op waited for from what it did', async () => {
    const spans = await spansOf(app, () => call({ entity: 'item', op: 'listOneByOne' }, Invocation.empty));
    const [op] = spans.filter((span) => span.kind === 'operation');

    expect(op.selfMs).toBeGreaterThan(0);
    expect(op.selfMs).toBeLessThan(op.ms);
  });
});
