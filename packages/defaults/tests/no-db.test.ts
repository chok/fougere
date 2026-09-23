/**
 * A project that declares no `db:` keeps its rows in memory, whatever the host — and says so.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { resolveStorage } from '../src/storage/ResolvedStorage.js';

class Note extends entity({ id: primary(), title: text() }) {}

afterEach(() => vi.restoreAllMocks());

describe('no db: declared', () => {
  it.each([['absent', undefined], ['false', false]] as const)('%s — rows live in memory, and the boot says so', async (_name, db) => {
    const said: string[] = [];
    vi.spyOn(console, 'warn').mockImplementation((...parts) => { said.push(parts.join(' ')); });

    const storage = resolveStorage(db as never);
    const notes = storage.storageFactory!(Note, 'note');
    const created = await notes.create({ title: 'kept' });

    expect(await notes.findById(created.id)).toMatchObject({ title: 'kept' });
    expect(said.join('\n')).toContain('no `db:` declared — rows live in memory');
  });
});
