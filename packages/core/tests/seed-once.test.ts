import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { entity, primary, text } from '@fougere/schema';
import { createApp, Crud, frond, runSeeds, storageOver, type Store, type Values } from '../src/index.js';

class Note extends entity({ id: primary(), title: text() }) {}
class NoteHandler extends Crud(Note) {}

const mapStore = (): Store => {
  const map = new Map<string, Values>();

  return {
    client: map,
    get: async (key) => map.get(key),
    has: async (key) => map.has(key),
    set: async (key, values) => { map.set(key, values); },
    delete: async (key) => map.delete(key),
    all: async () => [...map.values()],
  };
};

describe('a seed', () => {
  it('plants once, and a second boot reads the rows it finds as rows', async () => {
    // `list` answers a page, not an array. Read as an array, `.length` was undefined, the
    // emptiness check never held, and every boot planted the same rows again.
    await using app = await createApp({
      fronds: [frond('notes', { entities: [Note], handlers: [NoteHandler] })],
      createContainer,
      storageFactory: storageOver(() => mapStore()),
    });
    const seeds = [{ entityName: 'note', data: [{ title: 'first' }], filePath: 'Note.seed.ts' }];
    const said: string[] = [];

    await runSeeds(app, seeds, (line) => said.push(line));
    await runSeeds(app, seeds, (line) => said.push(line));

    expect((await app.storageFor('note')!.list()).length).toBe(1);
    expect(said.join('\n')).toMatch(/note: skipped \(1 exist\)/);
  });
});
