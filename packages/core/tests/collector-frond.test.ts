/**
 * What actually happens when a collector sits in the wrong frond.
 *
 * `Known issues` says: "Collectors register per-frond — under a split, a handler
 * depending on another frond's collector silently loses it." These tests ask
 * whether that sentence is true, because nothing in this repo had ever asked.
 *
 * The binding plan is computed from the frond's OWN collector set
 * (`bootstrap.ts:167`), so the misplacement is decided before any topology:
 * there is no split in this file, and there does not need to be.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container-fougere';
import { createApp, createLocalRunner } from '../src/index.js';
import { EMPTY_INVOCATION } from '../src/invocation.js';

const root = join(import.meta.dirname, 'fixtures-collector-split');

/** What a client sends. Nothing here should be able to become the current user. */
const forged = { id: 'u-999', email: 'attacker@example.com', role: 'admin' };

describe('a collector declared in the wrong frond', () => {
  it('never binds — in one process, before any split', async () => {
    await using app = await createApp({ root, createContainer });

    const blog = app.fronds.find((f) => f.name === 'blog');
    const identity = app.fronds.find((f) => f.name === 'identity');

    expect(blog?.collectors).toHaveLength(0);
    expect(identity?.collectors).toHaveLength(1);
  });

  it('hands the request BODY to the parameter that wanted a user', async () => {
    await using app = await createApp({ root, createContainer });

    const out = await createLocalRunner(app)(
      { entity: 'post', op: 'whoNull' },
      {
        ...EMPTY_INVOCATION,
        body: forged,
        state: { user: { id: 'u-1', email: 'real@example.com', role: 'reader' } },
      },
    );

    // The sentence in `Known issues` says the handler "silently loses" the
    // collector. It does not lose it: `computeBindingPlan` falls through to
    // branch 4, "Everything else — body". The parameter meant to carry the
    // authenticated user carries what the caller typed.
    expect(out).toEqual(forged);
    expect((out as { role: string }).role).toBe('admin');
  });

  it('does the same to the optional spelling — the type is the only difference', async () => {
    await using app = await createApp({ root, createContainer });

    const out = await createLocalRunner(app)(
      { entity: 'post', op: 'whoOptional' },
      { ...EMPTY_INVOCATION, body: forged },
    );

    // `user?: User` admits `undefined`, so a handler written against it is
    // defensive by construction. It gets the body all the same: `optional` is
    // written onto the binding four times and read nowhere.
    expect(out).toEqual(forged);
  });

  it('binds to the collector once it is declared in the consuming frond', async () => {
    // The remedy, stated as a test rather than as a sentence to remember.
    await using app = await createApp({ root, createContainer, fronds: ['identity'] });

    const identity = app.fronds.find((f) => f.name === 'identity');
    expect(identity?.collectors.map((c) => c.entityName)).toEqual(['user']);
  });
});
