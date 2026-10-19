import { describe, it, expect } from 'vitest';
import { stateOf } from '../src/runtime/server/stateOf.js';

describe('stateOf', () => {
  it('carries the session without its token, and nothing else of the event context', () => {
    const user = { id: 'u-1', since: new Date(0) };
    const context = { nitro: { errors: [] }, _nitro: { routeRules: {} }, matchedRoute: { path: '/x' }, params: {}, user, session: { id: 's-1', token: 'cookie' } };

    expect(stateOf({ context } as never)).toEqual({ user, session: { id: 's-1' } });
  });

  it('carries nothing when nobody is signed in', () => {
    expect(stateOf({ context: { nitro: {} } } as never)).toEqual({});
  });
});

describe('the state of the request a server-side call runs within', () => {
  it('is the session without its token, never the whole of Nitro\'s context', async () => {
    const { stateOfRequest } = await import('../src/runtime/server/stateOf.js');
    const context = { user: { id: 'u1' }, session: { id: 's1', token: 'secret' }, nitro: { internal: true } };

    expect(stateOfRequest(() => ({ context }))).toEqual({ user: { id: 'u1' }, session: { id: 's1' } });
  });

  it('is nothing outside a request', async () => {
    const { stateOfRequest } = await import('../src/runtime/server/stateOf.js');

    expect(stateOfRequest(() => undefined)).toEqual({});
    expect(stateOfRequest(() => { throw new Error('no request in scope'); })).toEqual({});
  });
});
