/**
 * An app written in JavaScript, against the packages as they are BUILT.
 *
 * Everything the session measured about plain JS lived in throwaway scripts: `frond()` boots
 * with no scan and no tsc, a declared dependency is injected, and a forgotten one is refused.
 * This file is that, kept — and it is `.mjs` on purpose, since the subject is what a consumer
 * without TypeScript receives.
 *
 * It reads `dist/`, so `pnpm run build` comes first; CI builds before it tests.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '../../container/dist/index.js';
import { createApp, createLocalRunner, frond, Invocation, Repository, storageOver } from '../dist/index.js';
import { entity, primary, text } from '../../schema/dist/index.js';

const store = () => {
  const held = new Map();

  return {
    client: held,
    get: async (key) => held.get(key),
    has: async (key) => held.has(key),
    set: async (key, values) => { held.set(key, values); },
    delete: async (key) => held.delete(key),
    all: async () => [...held.values()],
  };
};

class Note extends entity({ id: primary(), body: text() }) {}
class Clock { now() { return 'noon'; } }

const booting = (handlers, providers = [Clock]) => createApp({
  fronds: [frond('notes', { entities: [Note], providers, handlers })],
  createContainer,
  storageFactory: storageOver(() => store()),
});

describe('an app written in JavaScript', () => {
  it('boots from frond() alone — no scan, no compiler', async () => {
    // JavaScript has no `<Note>` to write: the statement says what it extends the repository of.
    class NoteHandler extends Repository {}
    await using app = await booting([{ ctor: NoteHandler, repository: Note }]);

    const run = createLocalRunner(app);
    const written = await run({ address: 'note', op: 'create' }, { ...Invocation.empty, input: { body: 'Hello' } });

    expect(written.body).toBe('Hello');
    expect((await run({ address: 'note', op: 'list' }, Invocation.empty)).items).toHaveLength(1);
  });

  it('injects what the declaration names', async () => {
    class NoteHandler extends Repository {
      constructor(clock) { super(); this.clock = clock; }
      async readStamp() { return this.clock.now(); }
    }

    await using app = await booting([{
      ctor: NoteHandler,
      repository: Note,
      deps: ['Clock'],
      operations: { readStamp: { binding: [] } },
    }]);

    expect(await createLocalRunner(app)({ address: 'note', op: 'readStamp' }, Invocation.empty)).toBe('noon');
  });

  it('refuses a constructor asking for more than it is declared', async () => {
    class NoteHandler extends Repository {
      constructor(clock) { super(); this.clock = clock; }
    }

    await expect(booting([{ ctor: NoteHandler, repository: Note, deps: [] }]))
      .rejects.toThrow(/constructor-arity/);
  });

  it('refuses an operation with no method under its name', async () => {
    class NoteHandler extends Repository {}

    await expect(booting([{ ctor: NoteHandler, repository: Note, deps: [], operations: { publish: { binding: [] } } }]))
      .rejects.toThrow(/operation-without-method/);
  });
});
