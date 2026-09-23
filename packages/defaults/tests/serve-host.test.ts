import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { bootApp } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-serve-host');

describe('a host serving a frond the config places at an address', () => {
  it('boots, because what it serves is never remote to it', async () => {
    // `fougere serve notes` died on `remotes is declared but remoteTransport is missing`: the
    // host dropped its remotes, and the boot fell back to reading them from the config.
    await using app = await bootApp(root, { only: ['notes'], topology: false });

    expect(app.remotes).toEqual({});
    await app.storageFor('note')!.create({ title: 'served here' });
    expect((await app.storageFor('note')!.list()).length).toBe(1);
  });

  it('does not route the frond it serves back out, with its topology followed', async () => {
    await using app = await bootApp(root, { only: ['notes'] });

    expect(app.remotes).toEqual({});
  });
});
