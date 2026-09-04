import { describe, it, expect } from 'vitest';
import { entity, primary, text, json } from '@fougere/schema';
import { recording, type Undo } from '../src/boot/frame.js';

/**
 * The optimistic check a compensated frame runs before it takes a write back.
 *
 * `recording` remembers the image that preceded an update; replaying the inverse first
 * re-reads the row and refuses when someone else moved it since. What counts as "moved"
 * is the one equality Schema declares — a hand-written comparison by serialisation lived
 * here and reported a conflict whenever a stored object came back with its members in a
 * different order, which no engine promises to preserve.
 */
class Doc extends entity({
  id: primary(),
  title: text(),
  payload: json(),
}) {}


function storageReturning(current: Record<string, unknown>) {
  const updates: { id: string; patch: Record<string, unknown> }[] = [];
  return {
    updates,
    async create(input: Record<string, unknown>) { return input; },
    async update(id: string, patch: Record<string, unknown>) {
      updates.push({ id, patch });
      return { ...current, ...patch };
    },
    async delete() { return true; },
    async findById() { return current; },
    async findByKeys() { return new Map(); },
  };
}

async function updateThenUnwind(stored: Record<string, unknown>, wrote: Record<string, unknown>) {
  const journal: Undo[] = [];
  const storage = storageReturning(stored);
  const recorded = recording(storage, 'Doc', Doc, journal);

  await (recorded as unknown as {
    update(id: string, patch: Record<string, unknown>): Promise<unknown>;
  }).update('1', wrote);

  expect(journal).toHaveLength(1);
  return { journal, storage };
}

describe('a compensated update, replayed', () => {
  it('does not call a conflict when a stored object comes back with its members reordered', async () => {
    const wrote = { payload: { a: 1, b: 2 } };
    const stored = { id: '1', title: 'x', payload: { b: 2, a: 1 } };

    const { journal } = await updateThenUnwind(stored, wrote);

    await expect(journal[0]!.run()).resolves.toBeUndefined();
  });

  it('treats a Date and its clone as the same instant', async () => {
    const wrote = { payload: { at: new Date('2026-08-24T10:00:00Z') } };
    const stored = { id: '1', title: 'x', payload: { at: new Date('2026-08-24T10:00:00Z') } };

    const { journal } = await updateThenUnwind(stored, wrote);

    await expect(journal[0]!.run()).resolves.toBeUndefined();
  });

  it('still refuses when the row really moved, naming the field', async () => {
    const wrote = { payload: { a: 1 } };
    const stored = { id: '1', title: 'x', payload: { a: 99 } };

    const { journal } = await updateThenUnwind(stored, wrote);

    await expect(journal[0]!.run()).rejects.toThrow(/was changed by someone else since \(payload\)/);
  });
});
