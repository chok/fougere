/**
 * A project that declares no source keeps its rows in memory, whatever the host — and says so.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { resolveStorage } from '../src/storage/ResolvedStorage.js';

class Note extends entity({ id: primary(), title: text() }) {}

afterEach(() => vi.restoreAllMocks());

describe('no source declared', () => {
  it.each([['absent', undefined], ['empty', {}]] as const)('%s — rows live in memory, and the boot says so', async (_name, sources) => {
    const said: string[] = [];
    vi.spyOn(console, 'warn').mockImplementation((...parts) => { said.push(parts.join(' ')); });

    const storage = resolveStorage(sources);
    const notes = storage.storageFactory!(Note, 'note');
    const created = await notes.create({ title: 'kept' });

    expect(await notes.findById(created.id)).toMatchObject({ title: 'kept' });
    expect(said.join('\n')).toContain('No sources: rows are kept in memory and lost on exit.');
  });
});

describe('the default source', () => {
  it('is the one entry listing no entities, and two of them refuse naming both', () => {
    expect(() => resolveStorage({ main: { type: 'memory' }, other: { type: 'memory' } } as never))
      .toThrow(/'main' and 'other' list no entities/);
  });
});
