/**
 * A handler is a container key in its own frond: a class beside it asking for `PostHandler` is handed
 * the instance the facade calls. From another frond it is refused at boot, pointed at its facade — the
 * bare handler skips the validation, the middlewares and the placement.
 */
import { describe, it, expect } from 'vitest';
import { createContainer, type Container } from '@fougere/container';
import { createApp, frond } from '../src/index.js';
import { op } from './contract.js';

class NoteHandler {
  async count() { return 3; }
}

class Digest {
  constructor(readonly notes: NoteHandler) {}
}

const boot = (digestIn: 'notes' | 'mail') => createApp({
  createContainer,
  storageFactory: () => ({}) as never,
  fronds: [
    frond('notes', {
      handlers: [{ ctor: NoteHandler, operations: { count: op({ cardinality: 'one' }) } }],
      providers: digestIn === 'notes' ? [{ ctor: Digest, deps: ['NoteHandler'] }] : [],
    }),
    frond('mail', { providers: digestIn === 'mail' ? [{ ctor: Digest, deps: ['NoteHandler'] }] : [] }),
  ],
});

describe('a handler, asked for by its class', () => {
  it('is handed inside its own frond — the instance its facade calls', async () => {
    await using app = await boot('notes');
    const notes = app.resolve<Container>('frond:notes');

    expect(notes.resolve<Digest>('Digest').notes).toBe(notes.resolve('NoteHandler'));
  });

  it('is refused from another frond, naming its facade', async () => {
    await expect(boot('mail')).rejects.toThrow(/NoteHandler, a handler of the frond 'notes'.*Facade<NoteHandler>/s);
  });
});
