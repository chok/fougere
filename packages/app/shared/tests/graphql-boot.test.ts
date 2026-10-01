/** `adapters: { graphql: true }` without the package that serves it refuses the boot, not the first query. */
import { describe, it, expect, vi } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { frond } from '@fougere/core';
import { configureFougere, useFougereApp } from '../src/boot.js';

vi.mock('@fougere/adapter-graphql', () => {
  throw new Error("Cannot find package '@fougere/adapter-graphql'");
});

class Note extends entity({ id: primary(), title: text() }) {}

describe('graphql declared on a web host', () => {
  it('refuses the boot when the package is not installed', async () => {
    configureFougere({
      fronds: [frond('notes', { entities: [Note] })],
      config: { db: { dialect: 'sqlite', path: ':memory:' }, adapters: { graphql: true } } as never,
      migrates: true,
    });

    await expect(useFougereApp()).rejects.toThrow(/adapters: \{ graphql: true \} is declared, but the package that serves it is not installed/);
  });
});
