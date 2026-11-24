import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { bootApp } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-serve-host');

describe('a host running the process the topology places at an address', () => {
  it('boots, because what it serves is never remote to it', async () => {
    await using app = await bootApp(root, { process: 'notes', migrates: true });

    expect(app.remotes).toEqual({});
    await app.storageFor('note')!.create({ title: 'served here' });
    expect((await app.storageFor('note')!.list()).length).toBe(1);
  });

  it('does not route the frond it serves back out, with its topology followed', async () => {
    await using app = await bootApp(root, { process: 'notes', migrates: true });

    expect(app.remotes).toEqual({});
  });
});

describe('an extension a frond carries', () => {
  it('mounts on the host that serves the frond, with nothing named by the host', async () => {
    await using app = await bootApp(root, { process: 'notes', migrates: true });

    expect(app.extensions()).toContain('mark');
    expect(app.container.resolve('Marked')).toBe('notes');
  });
});
