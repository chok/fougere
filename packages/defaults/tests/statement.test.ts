/**
 * A project that writes its fronds by hand is booted from what it wrote, and its sources are not
 * read — the compiler is what reads them, and it is not asked.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createLocalRunner, Invocation } from '@fougere/core';
import { bootApp } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-statement');

describe('boot, on a project that states its fronds', () => {
  it('serves what the statement names', async () => {
    await using app = await bootApp(root, { migrates: true });
    const run = createLocalRunner(app);

    await run({ address: 'note', op: 'create' }, Invocation.from({ input: { body: 'fern' } }));

    await expect(run({ address: 'note', op: 'list' }, Invocation.empty)).resolves.toMatchObject({ items: [{ body: 'fern' }] });
  });

  it('reads nothing the statement leaves out, even where the scan would look', async () => {
    await using app = await bootApp(root, { migrates: true });

    expect(app.fronds.map((frond) => frond.name)).toEqual(['notes']);
  });
});
