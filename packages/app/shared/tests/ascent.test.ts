/**
 * The order the Nitro plugin's shape produces — the one a unit test of `Lifecycle` alone
 * cannot see, because the bug was in the COMPOSITION: this host declared the framework's
 * seeding while the plugin declared its own migration, and the second landed after the first.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { configureFougere, useFougereApp } from '../src/boot.js';

class Note extends entity({ id: primary(), title: text() }) {}

const storage = () => ({
  list: async () => [], findById: async () => undefined, findBy: async () => undefined,
  findAllBy: async () => [], create: async (i: unknown) => i, update: async (_: string, i: unknown) => i,
  delete: async () => true, client: {}, output() { return this; },
}) as never;

afterEach(() => { configureFougere({}); });

describe('the ascent a host composes', () => {
  /**
   * The plugin resolves its own storage (a bundler needs its seed modules as static
   * imports), so this host resolves none — and used to contribute no `migrate` slot at all.
   * The plugin's own `migrate` was then APPENDED after the framework's `seeds`: on a fresh
   * database the seeding read a table that did not exist yet.
   */
  it('runs a host-declared migrate before the seeds, even when this host resolved no storage', async () => {
    const ran: string[] = [];
    configureFougere({
      storageFactory: storage,
      extensions: [
        { name: 'migrate', up: () => { ran.push('migrate'); } },
        { name: 'seeds', up: () => { ran.push('seeds'); } },
      ],
    });

    const app = await useFougereApp();
    expect(app.extensions()).toEqual(['migrate', 'seeds']);
    expect(ran).toEqual(['migrate', 'seeds']);
    await app.dispose();
  });

  it('declares the two framework members even when the host adds none', async () => {
    configureFougere({ storageFactory: storage });
    const app = await useFougereApp();
    expect(app.extensions()).toEqual(['migrate', 'seeds']);
    await app.dispose();
  });
});

void Note;
