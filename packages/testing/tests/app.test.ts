/**
 * What an app costs to obtain, and what it is made of.
 *
 * The engine is real SQLite — the DDL runs, the constraints exist — and nothing reaches
 * a disk. A test that wanted `createMemoryStorage` would be testing a storage that does not
 * ship.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createLocalRunner } from '@fougere/core';
import { EMPTY_INVOCATION } from '@fougere/core/contract';
import { testApp } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures');

describe('testApp', () => {
  it('boots the project and answers an op', async () => {
    await using app = await testApp({ root });
    const run = createLocalRunner(app);

    const created = await run({ entity: 'article', op: 'create' }, {
      ...EMPTY_INVOCATION,
      input: { title: 'A title', body: 'A body', status: 'draft', views: 0 },
    }) as { id: string; title: string };

    expect(created.id).toBeTruthy();
    expect(created.title).toBe('A title');
  });

  it('writes to a real engine — the row is there on the next call', async () => {
    await using app = await testApp({ root });
    const run = createLocalRunner(app);

    await run({ entity: 'article', op: 'create' }, {
      ...EMPTY_INVOCATION,
      input: { title: 'Kept', body: 'A body', status: 'draft', views: 0 },
    });
    const listed = await run({ entity: 'article', op: 'list' }, EMPTY_INVOCATION) as { items?: unknown[] } | unknown[];

    const rows = Array.isArray(listed) ? listed : listed.items ?? [];
    expect(rows).toHaveLength(1);
  });

  it('gives each call a database of its own', async () => {
    await using first = await testApp({ root });
    await run(first);
    await using second = await testApp({ root });

    const listed = await createLocalRunner(second)({ entity: 'article', op: 'list' }, EMPTY_INVOCATION) as { items?: unknown[] } | unknown[];

    const rows = Array.isArray(listed) ? listed : listed.items ?? [];
    expect(rows).toHaveLength(0);
  });
});

async function run(app: Awaited<ReturnType<typeof testApp>>) {
  await createLocalRunner(app)({ entity: 'article', op: 'create' }, {
    ...EMPTY_INVOCATION,
    input: { title: 'Leaked?', body: 'A body', status: 'draft', views: 0 },
  });
}
