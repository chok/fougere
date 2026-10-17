/**
 * What a `ref()` asks of a storage, on its own and under the guard that validates first.
 */
import { describe, it, expect, vi } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { StorageGuard } from '../src/dispatch/StorageGuard.js';
import { RelationGuard } from '../src/module/relation/RelationGuard.js';
import type { RelationCheck } from '../src/module/relation/RelationCheck.js';
import type { Releasing } from '../src/module/relation/Release.js';

class Post extends entity({ id: primary(), title: text(), authorId: text() }) {}

const storage = () => ({
  create: vi.fn(async (row: Record<string, unknown>) => row),
  update: vi.fn(async (_id: unknown, row: Record<string, unknown>) => row),
  upsertAll: vi.fn(async (rows: readonly Record<string, unknown>[]) => rows.length),
  delete: vi.fn(async (_id: string) => true),
});

/** A relation whose target holds exactly these keys. */
const authors = (held: string[]): RelationCheck & { missing: ReturnType<typeof vi.fn> } => ({
  field: 'authorId',
  target: 'author',
  missing: vi.fn(async (keys: readonly unknown[]) => keys.filter((key) => !held.includes(String(key)))),
});

describe('RelationGuard', () => {
  it('hands the storage back untouched when nothing is declared', () => {
    const rows = storage();

    expect(new RelationGuard('post').guard(rows)).toBe(rows);
  });

  it('refuses a write naming a target nothing holds, before it lands', async () => {
    const rows = storage();
    const guarded = new RelationGuard('post', [authors(['ada'])]).guard(rows);

    await expect(guarded.create({ id: 'p1', title: 't', authorId: 'bob' }))
      .rejects.toThrow(/post\.create — authorId "bob" — no author holds it/);
    expect(rows.create).not.toHaveBeenCalled();
  });

  it('lets a write through once its target is held', async () => {
    const rows = storage();
    const guarded = new RelationGuard('post', [authors(['ada'])]).guard(rows);

    await guarded.create({ id: 'p1', title: 't', authorId: 'ada' });

    expect(rows.create).toHaveBeenCalledWith({ id: 'p1', title: 't', authorId: 'ada' });
  });

  it('reads a whole page in one question per relation', async () => {
    const relation = authors(['ada', 'bob']);
    const guarded = new RelationGuard('post', [relation]).guard(storage());

    await guarded.upsertAll([{ authorId: 'ada' }, { authorId: 'bob' }, { authorId: 'ada' }]);

    expect(relation.missing).toHaveBeenCalledTimes(1);
    expect(relation.missing).toHaveBeenCalledWith(['ada', 'bob']);
  });

  it('asks nothing of a patch that does not carry the field', async () => {
    const relation = authors([]);
    const guarded = new RelationGuard('post', [relation]).guard(storage());

    await guarded.update('p1', { title: 'renamed' });

    expect(relation.missing).not.toHaveBeenCalled();
  });

  it('releases what names a row before the row goes, and answers what the storage answered', async () => {
    const order: string[] = [];
    const rows = storage();
    rows.delete.mockImplementation(async () => { order.push('row'); return true; });
    const releasing: Releasing = {
      dependentsOf: () => [],
      rowsOf: () => undefined,
      schemaOf: () => undefined,
      journal: () => undefined,
      peers: () => [{ release: async () => { order.push('peer'); } }],
    };

    const gone = await new RelationGuard('post', [], releasing).guard(rows).delete('p1');

    expect(gone).toBe(true);
    expect(order).toEqual(['peer', 'row']);
  });

  it('stands under the validating guard: a row the guard refuses is never read across', async () => {
    const relation = authors(['ada']);
    const guarded = new StorageGuard(Post.getFields(), 'post')
      .guard(new RelationGuard('post', [relation]).guard(storage()));

    await expect(guarded.create({ id: 'p1', title: 't', authorId: 'ada', nawak: 1 })).rejects.toThrow();
    expect(relation.missing).not.toHaveBeenCalled();
  });
});
