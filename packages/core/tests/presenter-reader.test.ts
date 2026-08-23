/**
 * A computed field may depend on who is asking, and it runs once for the page.
 *
 * Both used to be impossible, and for the same reason: `presentEgress` called the
 * method with the row and nothing else, once per row. So `canEdit` — which is just
 * `ownerUserId === user.id` — had nowhere to live, and any field doing a read cost
 * one query per row.
 *
 * The fix is that a presenter binds like a handler: what its signature declares
 * after the rows is resolved from the same invocation, by the same collectors.
 */
import { scanProject } from '../src/node.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner } from '../src/index.js';
import type { OrmFactory } from '../src/index.js';
import { EMPTY_INVOCATION } from '../src/wire/invocation.js';
import ListPresenter from './fixtures-presenter-reader/fronds/listes/presenters/ListPresenter.js';

const root = join(import.meta.dirname, 'fixtures-presenter-reader');

const rows = [
  { id: 'l1', title: 'Mienne', ownerUserId: 'u1' },
  { id: 'l2', title: 'Celle d\'un autre', ownerUserId: 'u2' },
];

const ormFactory: OrmFactory = (() => ({
  list: vi.fn(async () => rows),
  findById: vi.fn(async () => rows[0]),
  create: vi.fn(), update: vi.fn(), delete: vi.fn(),
  output: vi.fn(function (this: unknown) { return this; }),
})) as unknown as OrmFactory;

beforeEach(() => { ListPresenter.calls = 0; });

const scan = await scanProject(root);
const app = () => createApp({ scan, createContainer, ormFactory });

describe('a computed field sees the reader', () => {
  it('answers differently for two readers, on the same rows', async () => {
    await using mounted = await app();
    const run = createLocalRunner(mounted);

    const asOwner = await run(
      { entity: 'list', op: 'list' },
      { ...EMPTY_INVOCATION, state: { user: { id: 'u1', name: 'Moi' } } },
    ) as { id: string; canEdit: boolean }[];

    const asStranger = await run(
      { entity: 'list', op: 'list' },
      { ...EMPTY_INVOCATION, state: { user: { id: 'u9', name: 'Quelqu\'un' } } },
    ) as { id: string; canEdit: boolean }[];

    expect(asOwner.map((l) => l.canEdit)).toEqual([true, false]);
    expect(asStranger.map((l) => l.canEdit)).toEqual([false, false]);
  });

  it('answers for nobody when nobody is asking', async () => {
    await using mounted = await app();
    const run = createLocalRunner(mounted);
    const out = await run({ entity: 'list', op: 'list' }, EMPTY_INVOCATION) as { canEdit: boolean }[];

    expect(out.map((l) => l.canEdit)).toEqual([false, false]);
  });
});

describe('a computed field runs once for the page', () => {
  it('is called once, whatever the number of rows', async () => {
    await using mounted = await app();
    const run = createLocalRunner(mounted);
    await run(
      { entity: 'list', op: 'list' },
      { ...EMPTY_INVOCATION, state: { user: { id: 'u1', name: 'Moi' } } },
    );

    // Two rows, one call. Row-at-a-time would say 2 — and a field doing a read
    // would have issued two queries without anything in the code saying so.
    expect(ListPresenter.calls).toBe(1);
  });
});
