/**
 * A verb the subject uses is taught once, in the frond's `vocabulary/`, and every op that leads
 * with it reads as that kind — no `operations:` entry per op.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { resolveEffectiveOperations } from '@fougere/core';
import { scanProject } from '../src/index.js';

describe('a verb taught in vocabulary/', () => {
  it('tells the kind of every op that leads with it', async () => {
    const { fronds, vocabulary } = await scanProject(join(import.meta.dirname, 'fixtures-verbs'));
    // What `createApp` does with a scan's vocabulary, before it reads an op.
    for (const entry of vocabulary ?? []) entry.term.register();
    const model = resolveEffectiveOperations(fronds);
    const price = fronds[0]!.handlers.find((one) => one.address === 'price')!;

    expect(model.diagnostics.map((one) => one.code)).toEqual([]);
    expect(model.forHandler(price).get('totalPrice')?.kind).toBe('query');
  }, 30_000);
});
