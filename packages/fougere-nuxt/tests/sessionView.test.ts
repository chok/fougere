import { describe, it, expect } from 'vitest';
import { sessionViewOf } from '../src/runtime/session/view.js';

describe('sessionViewOf', () => {
  it('empty context → anonymous view', () => {
    expect(sessionViewOf({})).toEqual({ user: null });
  });

  it('resolved user travels, secrets do not', () => {
    const view = sessionViewOf({
      user: { id: 'u1', email: 'a@b.c', name: 'Ada', passwordHash: 'x' },
      session: { userId: 'u1' },
    });
    expect(view.user).toEqual({ id: 'u1', email: 'a@b.c', name: 'Ada' });
    expect(view.user).not.toHaveProperty('passwordHash');
  });

  it('ignores the rest of the request context', () => {
    const view = sessionViewOf({ user: { id: 'u1' }, nitro: {}, matchedRoute: {} });
    expect(view).toEqual({ user: { id: 'u1' } });
  });
});
