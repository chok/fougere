/** `adapters: { graphql: true }` without the package that serves it refuses the boot, not the first query. */
import { describe, it, expect } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { frond } from '@fougere/core';
import { configureFougere, useFougereApp } from '../src/boot.js';
import { executor } from '../src/graphql.js';

class Note extends entity({ id: primary(), title: text() }) {}

describe('graphql declared on a web host', () => {
  it('names the missing package when it cannot be loaded', async () => {
    const missing = () => Promise.reject(new Error("Cannot find package '@fougere/adapter-graphql'"));

    await expect(executor(missing)).rejects.toThrow(/adapters: \{ graphql: true \} is declared, but the package that serves it is not installed/);
  });

  it('loads it at boot, so a declared GraphQL is ready before the first query', async () => {
    configureFougere({
      fronds: [frond('notes', { entities: [Note] })],
      config: { db: { dialect: 'sqlite', path: ':memory:' }, adapters: { graphql: true } } as never,
      migrates: true,
    });

    const app = await useFougereApp();
    expect(app.adapters.graphql).toBe(true);
    await app.dispose();
  });
});
