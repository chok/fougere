import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { createMemoryStorage } from '@fougere/adapter-memory';
import { createApp, createLocalRunner, Invocation } from '@fougere/core';
import { betterAuth } from '../src/index.js';

const user = { id: 'u1', name: 'Ada', email: 'ada@example.com', emailVerified: true, createdAt: '2026-09-23T00:00:00.000Z', updatedAt: '2026-09-23T00:00:00.000Z' };

describe('who is signed in', () => {
  it('is an operation of the auth frond, answering the user a call carries, or nobody — an answer, not a missing row', async () => {
    await using app = await createApp({
      fronds: [betterAuth({ secret: 'x'.repeat(32) })],
      storageFactory: createMemoryStorage,
      createContainer,
    });
    const get = (state: Record<string, unknown>) => createLocalRunner(app)({ address: 'session', op: 'get' }, { ...Invocation.empty, state });

    expect(await get({ user })).toMatchObject({ user: { id: 'u1', name: 'Ada' } });
    expect(await get({})).toEqual({ user: null });
  });
});
