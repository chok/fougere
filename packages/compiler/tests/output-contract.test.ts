/** An answer with no view leaves whole, so a union naming an entity is refused rather than served. */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { scanProject } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-output-contract');
const refusedOps = async () => {
  const { diagnostics } = await scanProject(root);

  return diagnostics
    .filter((diagnostic) => diagnostic.code === 'output-contract-ambiguous')
    .map((diagnostic) => diagnostic.subject);
};

describe('an output naming an entity beside another type', () => {
  it('is refused, between two entities, in a list, or beside a scalar', async () => {
    expect(await refusedOps()).toEqual(expect.arrayContaining([
      'AccountHandler.settle',
      'AccountHandler.settleAll',
      'AccountHandler.describe',
    ]));
  });

  it('leaves an absence and a union of scalars alone', async () => {
    const refused = await refusedOps();

    expect(refused).not.toContain('AccountHandler.find');
    expect(refused).not.toContain('AccountHandler.count');
  });
});

describe('a parameter listening to several facts', () => {
  const refused = async () => {
    const { diagnostics } = await scanProject(root);

    return diagnostics
      .filter((diagnostic) => diagnostic.code === 'fact-contract-ambiguous')
      .map((diagnostic) => diagnostic.subject);
  };

  it('is refused on a Fact and on a Pipe, and one fact is left alone', async () => {
    expect((await refused()).sort()).toEqual(['ListenerHandler.finished', 'ListenerHandler.heardTwo']);
  });
});
