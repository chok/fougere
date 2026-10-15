/**
 * `title: Post['title']` names the field the value obeys, and only the source says so: the checker
 * answers `string`. The scan reads the syntax, and the primary also designates a row.
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

describe('a parameter typed by a field of an entity', () => {
  it('designates a row of that entity when the field is its primary', async () => {
    expect((await bindingOf('publish'))[0]?.source)
      .toEqual({ kind: 'param', name: 'id', field: { entity: 'Post', name: 'id' }, identifies: 'Post' });
  });

  it('borrows the rules of any other field, and designates nothing', async () => {
    const { diagnostics } = await scanProject(project);

    expect((await bindingOf('retitle'))[1]?.source).toEqual({ kind: 'param', name: 'title', field: { entity: 'Post', name: 'title' } });
    expect(diagnostics).toEqual([]);
  });
});
