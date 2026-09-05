/**
 * A prefab op emits the view named for IT.
 *
 * `Crud(E, Output)` scopes the injected storage, so it restricts the whole handler —
 * an op needing the full row breaks. `Crud(E, { list: Card })` is a declaration
 * instead: the storage keeps handing full rows (judges can read every field), and the
 * façade projects each op's result onto the view that op declared.
 */
import { scanProject } from '../src/node.js';
import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner } from '../src/index.js';
import type { StorageFactory } from '../src/index.js';
import type { InvocationContext } from '../src/wire/Invocation.js';

const root = join(import.meta.dirname, 'fixtures-crud-views');

/** A storage that realises and never judges — it always hands back the FULL row. */
function fullRowStorage() {
  const row = { id: 'note-1', title: 'Titre', body: 'Le corps entier', ownerId: 'u1', createdAt: 'now' };
  const storage = {
    row,
    // `ListResult` IS an array — the real storage returns rows, not an envelope.
    list: vi.fn(async () => [row]),
    findById: vi.fn(async () => row),
    create: vi.fn(async () => row),
    update: vi.fn(async () => row),
    delete: vi.fn(async () => true),
    output: vi.fn(() => storage),
  };
  return storage;
}

async function boot() {
  const storage = fullRowStorage();
  const app = await createApp({ scan: await scanProject(root), createContainer, storageFactory: vi.fn(() => storage) as unknown as StorageFactory });
  return { app, storage, run: createLocalRunner(app) };
}

const call = (): InvocationContext => ({ params: { id: 'note-1' }, query: {}, input: undefined, state: {} });

describe('a view named for one op', () => {
  it('projects that op onto its view — the index ships cards', async () => {
    const { app, run } = await boot();

    const rows = await run({ entity: 'note', op: 'list' }, call()) as Record<string, unknown>[];

    expect(Object.keys(rows[0]!).sort()).toEqual(['id', 'title']);
    await app.dispose();
  });

  it('leaves every other op on the entity — the full row still travels', async () => {
    const { app, run } = await boot();

    const note = await run({ entity: 'note', op: 'findById' }, call()) as Record<string, unknown>;

    expect(note.body).toBe('Le corps entier');
    await app.dispose();
  });

  it('does not scope the storage — a judge still reads the fields the view omits', async () => {
    const { app, storage } = await boot();

    // The handler-wide form calls .output(view) ; the per-op form must not.
    expect(storage.output).not.toHaveBeenCalled();
    await app.dispose();
  });
});

/**
 * A presenter's computed fields are an ADDITION to the entity's output — so they follow
 * the same rule as the entity's own fields: added where the output is open, absent where
 * the author closed it by naming a view. Naming the audience is what makes it closed.
 */
describe('a computed field meets the same boundary', () => {
  it('rides along on an op with no view — open is the default', async () => {
    const { app, run } = await boot();

    const note = await run({ entity: 'note', op: 'findById' }, call()) as Record<string, unknown>;

    expect(note.excerpt).toBe('Le ');
    await app.dispose();
  });

  it('stays out of an op that named its view — the author stated the list', async () => {
    const { app, run } = await boot();

    const rows = await run({ entity: 'note', op: 'list' }, call()) as Record<string, unknown>[];

    expect(Object.keys(rows[0]!).sort()).toEqual(['id', 'title']);
    expect(rows[0]).not.toHaveProperty('excerpt');
    await app.dispose();
  });
});
