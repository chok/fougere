/**
 * A row is read in the format its extension names, so a directory written by hand in YAML
 * answers like one this source wrote in JSON. What is new is written in the source's `format`.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { entity, primary, text, number, created } from '@fougere/schema';
import { Sources } from '@fougere/core';
import { describe, expect, it } from 'vitest';
import { createFileSource } from '../src/index.js';

class Snapshot extends entity({
  id: primary(),
  label: text({ min: 1 }),
  size: number(),
  takenAt: created(),
}) {}

const directory = () => mkdtempSync(join(tmpdir(), 'fougere-yaml-'));

describe('rows in YAML', () => {
  it('reads a row written by hand, dates included', async () => {
    const path = directory();
    mkdirSync(join(path, 'snapshot'));
    writeFileSync(join(path, 'snapshot', 'books.yaml'), 'id: books\nlabel: Books\nsize: 3\ntakenAt: 2026-10-25T10:00:00.000Z\n');
    writeFileSync(join(path, 'snapshot', 'users.yml'), 'id: users\nlabel: Users\nsize: 1\ntakenAt: 2026-10-25T10:00:00.000Z\n');
    const rows = createFileSource({ path }).storageFactory(Snapshot as never, 'snapshot');

    const books = await rows.findById('books');
    expect(books).toMatchObject({ label: 'Books', size: 3 });
    expect(books?.takenAt).toBeInstanceOf(Date);
    expect((await rows.list()).map((row) => row.id).sort()).toEqual(['books', 'users']);
  });

  it('writes a new row in the format the source names, and rewrites a row in its own', async () => {
    const path = directory();
    mkdirSync(join(path, 'snapshot'));
    writeFileSync(join(path, 'snapshot', 'old.json'), JSON.stringify({ id: 'old', label: 'Old', size: 1, takenAt: '2026-10-25T10:00:00.000Z' }));
    const rows = createFileSource({ path, format: 'yaml' }).storageFactory(Snapshot as never, 'snapshot');

    await rows.create({ id: 'new', label: 'New', size: 2 });
    await rows.update('old', { label: 'Older' });

    expect((await readdir(join(path, 'snapshot'))).sort()).toEqual(['new.yaml', 'old.json']);
    expect(await readFile(join(path, 'snapshot', 'new.yaml'), 'utf8')).toContain('label: New');
    expect(await rows.findById('old')).toMatchObject({ label: 'Older' });
  });

  it('refuses one key written in two formats, naming both files', async () => {
    const path = directory();
    mkdirSync(join(path, 'snapshot'));
    writeFileSync(join(path, 'snapshot', 's1.json'), '{}');
    writeFileSync(join(path, 'snapshot', 's1.yaml'), 'id: s1\n');
    const rows = createFileSource({ path }).storageFactory(Snapshot as never, 'snapshot');

    await expect(rows.findById('s1')).rejects.toThrow(/'s1' is written twice — .*s1\.json and .*s1\.yaml/);
  });

  it('refuses a format the source cannot write', () => {
    expect(() => Sources.open({ type: 'file', path: directory(), format: 'toml' } as never, 'sources.conf'))
      .toThrow(/json.*yaml/);
  });
});
