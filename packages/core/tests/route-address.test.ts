import { describe, expect, it } from 'vitest';
import { Call } from '../src/wire/call.js';
import { RouteAddress } from '../src/wire/RouteAddress.js';

describe('RouteAddress', () => {
  it('compares every routing dimension', () => {
    const address = new RouteAddress({
      surface: 'public',
      entity: 'product',
      operation: 'list',
    });

    expect(address.equals(new RouteAddress(address.toJSON()))).toBe(true);
    expect(address.equals(new RouteAddress({ ...address.toJSON(), surface: 'admin' }))).toBe(false);
    expect(address.toString()).toBe('public/product.list');
  });

  it('uses collision-safe keys', () => {
    const left = new RouteAddress({ entity: 'a/b', operation: 'c' });
    const right = new RouteAddress({ entity: 'a', operation: 'b/c' });

    expect(left.key()).not.toBe(right.key());
  });

  it('refuses incomplete identities', () => {
    expect(() => new RouteAddress({ entity: ' ', operation: 'list' })).toThrow(/entity/);
    expect(() => new RouteAddress({ entity: 'product', operation: '' })).toThrow(/operation/);
  });
});

describe('Call', () => {
  it('normalizes its invocation once', () => {
    const address = new RouteAddress({ entity: 'product', operation: 'create' });
    const call = new Call(address, { body: { name: 'Fern', omitted: undefined } });

    expect(call.address).toBe(address);
    expect(call.invocation.body).toEqual({ name: 'Fern' });
    expect(Object.isFrozen(call)).toBe(true);
  });
});
