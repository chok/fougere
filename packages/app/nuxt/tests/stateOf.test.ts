import { describe, it, expect } from 'vitest';
import { stateOf } from '../src/runtime/server/stateOf.js';

describe('stateOf', () => {
  it('carries the session and nothing else of the event context', () => {
    const user = { id: 'u-1', since: new Date(0) };
    const context = { nitro: { errors: [] }, _nitro: { routeRules: {} }, matchedRoute: { path: '/x' }, params: {}, user, session: { id: 's-1' } };

    expect(stateOf({ context } as never)).toEqual({ user, session: { id: 's-1' } });
  });

  it('carries nothing when nobody is signed in', () => {
    expect(stateOf({ context: { nitro: {} } } as never)).toEqual({});
  });
});
