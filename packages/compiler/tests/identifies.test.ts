/**
 * `id: Post['id']` designates a row, and only the source says so: the checker answers `string`.
 * The scan reads the syntax and holds it to the entity's primary.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { computeBindingPlan } from '@fougere/core/descriptor';
import { scanProject } from '../src/scan/scanner.js';

const project = join(import.meta.dirname, 'fixtures-identifies');

async function bindingOf(op: string) {
  const { fronds } = await scanProject(project);
  const handler = fronds[0].handlers.find((one) => one.address === 'post')!;

  return computeBindingPlan(handler.operations.get(op)!.signature!.params, new Set());
}

describe('a parameter typed by the primary of an entity', () => {
  it('designates a row of that entity', async () => {
    expect((await bindingOf('publish'))[0]?.source).toEqual({ kind: 'param', name: 'id', identifies: 'Post' });
  });

  it('stays an ordinary value when the field is not the primary, and the scan says so', async () => {
    const { diagnostics } = await scanProject(project);

    expect((await bindingOf('retitle'))[1]?.source).toEqual({ kind: 'param', name: 'title' });
    expect(diagnostics.find((one) => one.code === 'parameter-identifies-non-primary')?.message)
      .toMatch(/Post's primary is 'id'/);
  });
});
