/** `protocols: { graphql: {} }` is served by what the config imports — and refuses the boot without it. */
import '@fougere/adapter-sql';
import { describe, it, expect } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { frond, serves } from '@fougere/core';
import { configureFougere, useFougereApp } from '../src/boot.js';

class Note extends entity({ id: primary(), title: text() }) {}

const declaring = () => configureFougere({
  fronds: [frond('notes', { entities: [Note] })],
  config: { sources: { main: { type: 'sqlite', path: ':memory:' } }, protocols: { graphql: {} } } as never,
  migrates: true,
});

describe('graphql named on a web host', () => {
  it('refuses the boot, naming the import, when no adapter serves it', async () => {
    declaring();

    await expect(useFougereApp()).rejects.toThrow(/protocols\.graphql: Unknown protocol 'graphql' — import the adapter that serves it/);
  });

  it('serves it once the adapter is imported', async () => {
    await import('@fougere/adapter-graphql');
    declaring();

    const app = await useFougereApp();
    expect(serves(app.protocols, 'graphql')).toBe(true);
    await app.dispose();
  });
});
