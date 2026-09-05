/**
 * No argument, and the app knows what it is about.
 *
 * This file sits in `fronds/press/tests/`, which states two things a reader sees by
 * looking at the path: the project starts above `fronds/`, and the subject is `press`.
 * The neighbouring frond `billing` is not booted — same statement `remotes:` makes in
 * production, from the same kind of declaration.
 */
import { describe, it, expect } from 'vitest';
import { createLocalRunner } from '@fougere/core';
import { EMPTY_INVOCATION } from '@fougere/core/contract';
import { testApp } from '../../../../../src/index.js';

describe('a test that states nothing', () => {
  it('boots the frond it sits in, and only that one', async () => {
    await using app = await testApp();

    expect(app.fronds.map((frond) => frond.name)).toEqual(['press']);
  });

  it('answers on its own entity', async () => {
    await using app = await testApp();

    const created = await createLocalRunner(app)({ entity: 'article', op: 'create' }, {
      ...EMPTY_INVOCATION,
      input: { title: 'From position alone', body: 'A body', status: 'draft', views: 0 },
    }) as { title: string };

    expect(created.title).toBe('From position alone');
  });
});
