/**
 * A handler built on `Repository<Post>` serves the five operations it brings, beside its own, and
 * none of the other gestures of the rows — TypeScript erases `<Post>`, so the scan reads it.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, Invocation, storageOver, type Values } from '@fougere/core';

/** Rows in a Map, as `@fougere/adapter-memory` keeps them. */
const storageFactory = storageOver(() => {
  const map = new Map<string, Values>();

  return {
    client: map,
    get: async (key: string) => map.get(key),
    has: async (key: string) => map.has(key),
    set: async (key: string, values: Values) => { map.set(key, values); },
    delete: async (key: string) => map.delete(key),
    all: async () => [...map.values()],
  };
});
import { scanProject, writtenStatement } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-handler-repository');

describe('a handler that extends Repository<Post>', () => {
  it('serves the five and its own, and no other gesture of the rows', async () => {
    const { fronds } = await scanProject(root);
    const handler = fronds[0]!.handlers[0]!;

    expect([...handler.operations.keys()].sort()).toEqual(['create', 'delete', 'findById', 'list', 'publish', 'update']);
  }, 30_000);

  it('answers through the rows the boot seats it on, booted from the written statement', async () => {
    await using app = await createApp({ ...(await writtenStatement(root)), createContainer, storageFactory });
    const run = createLocalRunner(app);

    const draft = await run({ address: 'post', op: 'create' }, { ...Invocation.empty, input: { title: 'A post' } }) as { id: string };
    const published = await run({ address: 'post', op: 'publish' }, { ...Invocation.empty, params: { id: draft.id } });
    const listed = await run({ address: 'post', op: 'list' }, Invocation.empty);

    expect(published).toMatchObject({ id: draft.id, status: 'published' });
    expect(listed).toMatchObject({ items: [{ id: draft.id, status: 'published' }] });
  }, 30_000);
});
