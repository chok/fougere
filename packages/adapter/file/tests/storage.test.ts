/**
 * A row survives the process — which is the only thing this source has that memory has not.
 *
 * The thirteen gestures are `storageOver`'s and are pinned by the Map realization; what is
 * under test here is the four this package supplies, and the two things a directory adds:
 * a key becomes a filename, and what is written is still there after everything is dropped.
 */
import { mkdtempSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { entity, primary, text, number, created } from '@fougere/schema';
import { describe, expect, it } from 'vitest';
import { setupFile } from '../src/index.js';

class Snapshot extends entity({
  id: primary(),
  label: text({ min: 1 }),
  size: number(),
  takenAt: created(),
}) {}

const open = () => {
  const path = mkdtempSync(join(tmpdir(), 'fougere-file-'));
  return { path, source: setupFile({ path }) };
};

describe('rows as files', () => {
  it('writes one file per row, and answers it back', async () => {
    const { path, source } = open();
    const rows = source.storageFactory(Snapshot as never, 'snapshot');

    const written = await rows.create({ id: 's1', label: 'first', size: 10 });
    expect(written).toMatchObject({ id: 's1', label: 'first', size: 10 });
    // `created()` is realized by the storage, not by the caller — the axis, through the frame.
    expect(written.takenAt).toBeInstanceOf(Date);

    expect(await readdir(join(path, 'snapshot'))).toEqual(['s1.json']);
    expect(await rows.findById('s1')).toMatchObject({ label: 'first' });
  });

  it('survives a second source over the same directory — what memory cannot do', async () => {
    const { path } = open();
    await setupFile({ path }).storageFactory(Snapshot as never, 'snapshot')
      .create({ id: 's1', label: 'durable', size: 1 });

    // A different source, a different factory, a different Storage. The rows are still there.
    const reopened = setupFile({ path }).storageFactory(Snapshot as never, 'snapshot');
    expect(await reopened.findById('s1')).toMatchObject({ label: 'durable' });
  });

  it('answers the gestures the frame derives, over files', async () => {
    const { source } = open();
    const rows = source.storageFactory(Snapshot as never, 'snapshot');

    await rows.create({ id: 'a', label: 'one', size: 1 });
    await rows.create({ id: 'b', label: 'two', size: 2 });
    expect(await rows.upsertAll([{ id: 'c', label: 'three', size: 3 }, { id: 'a', label: 'ONE', size: 9 }])).toBe(2);

    expect((await rows.list()).length).toBe(3);
    expect(await rows.findBy({ label: 'two' })).toMatchObject({ id: 'b' });
    expect((await rows.findAllBy({ size: 3 })).length).toBe(1);
    expect([...(await rows.findByKeys(['a', 'zz'])).keys()]).toEqual(['a']);
    expect((await rows.findByKeys(['a'])).get('a')).toMatchObject({ label: 'ONE' });

    const page = await rows.list({ limit: 2, count: true });
    expect(page.length).toBe(2);
    expect(page.total).toBe(3);
    expect(page.hasMore).toBe(true);
  });

  it('keeps the creation stamp across an upsert, and refuses a second create', async () => {
    const { source } = open();
    const rows = source.storageFactory(Snapshot as never, 'snapshot');

    const first = await rows.create({ id: 's1', label: 'first', size: 1 });
    const again = await rows.upsert({ id: 's1', label: 'second', size: 2 });
    expect(again.label).toBe('second');
    // The row keeps the moment it appeared — the same contract SQL states for an overwrite.
    expect(new Date(again.takenAt as never).getTime()).toBe((first.takenAt as Date).getTime());

    await expect(rows.create({ id: 's1', label: 'third', size: 3 })).rejects.toThrow(/already exists/);
  });

  it('deletes, and says whether there was anything to delete', async () => {
    const { source } = open();
    const rows = source.storageFactory(Snapshot as never, 'snapshot');

    await rows.create({ id: 's1', label: 'x', size: 1 });
    expect(await rows.delete('s1')).toBe(true);
    expect(await rows.delete('s1')).toBe(false);
    expect(await rows.findById('s1')).toBeUndefined();
  });

  it('refuses a key that would leave its directory', async () => {
    const { source } = open();
    const rows = source.storageFactory(Snapshot as never, 'snapshot');

    await expect(rows.create({ id: '../escaped', label: 'x', size: 1 }))
      .rejects.toThrow(/cannot be a filename/);
  });

  it('reads an entity nothing has written yet as empty, not as a failure', async () => {
    const { source } = open();
    const rows = source.storageFactory(Snapshot as never, 'snapshot');

    // `toHaveLength` and not `toEqual([])`: a `ListResult` IS an array and carries
    // `hasMore`/`endCursor` as own properties, which the frame sets either way.
    const page = await rows.list();
    expect(page).toHaveLength(0);
    expect(page.hasMore).toBe(false);
    expect(await rows.findById('nope')).toBeUndefined();
  });

  it('migrates by making the directory exist, and hands out no transaction', async () => {
    const { path, source } = open();
    expect(source.transacted).toBeUndefined();

    await source.migrate!({ fronds: [{ name: 'archive', entities: [{ name: 'Snapshot' }] }], elsewhere: [] });
    expect(await readdir(path)).toContain('snapshot');
  });
});
