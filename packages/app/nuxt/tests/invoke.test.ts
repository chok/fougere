/**
 * `invoke` hands a call the state every other door hands it — the session without its token — and
 * not the whole of Nitro's context, which it used to pass, internals and session token included.
 */
import { describe, it, expect, vi } from 'vitest';

const context = { user: { id: 'u1' }, session: { id: 's1', token: 'secret' }, nitro: { internal: true } };
vi.mock('nitropack/runtime', () => ({ useEvent: () => ({ context }) }));

const handed: unknown[] = [];
vi.mock('@fougere/app', () => ({
  useFougereApp: async () => ({}),
  invokeOn: async (_app: unknown, _target: unknown, _op: unknown, _input: unknown, state: unknown) => {
    handed.push(state);

    return 'ok';
  },
}));

describe('invoke', () => {
  it('hands the call the resolved state, not the request context', async () => {
    const { invoke } = await import('../src/runtime/server/utils/invoke.js');

    await invoke({ name: 'Post' }, 'list');

    expect(handed).toEqual([{ user: { id: 'u1' }, session: { id: 's1' } }]);
  });
});
