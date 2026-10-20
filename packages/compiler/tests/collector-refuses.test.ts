/**
 * What a collector refuses when a required parameter finds nothing is read off its `missing()`,
 * through the helpers it calls, and joins the refusals of every op asking for it without `?`. The
 * handler no longer writes the check, so its body alone would have lost the code.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { resolveEffectiveOperations } from '@fougere/core';
import { scanProject } from '../src/scan/scanner.js';

const root = join(import.meta.dirname, 'fixtures-collector-refuses');

describe('a collector\'s missing()', () => {
  it('is walked like an operation, and what it refuses joins the ops that require it', async () => {
    const { fronds } = await scanProject(root);
    const desk = fronds.find((frond) => frond.name === 'desk')!;
    const { operations } = resolveEffectiveOperations(fronds, { diagnostics: [] });
    const errorsOf = (name: string) => operations.find((op) => op.frond === 'desk' && op.name === name)!.errors ?? [];

    expect(desk.collectors[0]!.refuses).toEqual(['UNAUTHORIZED']);
    expect(errorsOf('mine')).toEqual(['UNAUTHORIZED']);
    expect(errorsOf('maybe')).toEqual([]);
  }, 30_000);
});
