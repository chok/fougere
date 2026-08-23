import { describe, expect, it, vi } from 'vitest';
import { Call } from '../src/contract/Call.js';
import { RouteAddress } from '../src/contract/RouteAddress.js';
import type { Route, RouteKind } from '../src/dispatch/Route.js';
import { RouteRegistry } from '../src/dispatch/RouteRegistry.js';

function route(address: RouteAddress, kind: RouteKind = 'local'): Route {
  return { kind, address, execute: vi.fn(async (_call: Call) => kind) };
}

describe('RouteRegistry', () => {
  it('finds the exact registered operation', () => {
    const registry = new RouteRegistry();
    const address = new RouteAddress({ entity: 'product', operation: 'list' });
    const registered = route(address);

    registry.register(registered);

    expect(registry.find(new RouteAddress(address.toJSON()))).toBe(registered);
    expect(registry.size).toBe(1);
    expect(registry.routes()).toEqual([registered]);
  });

  it('keeps surfaces distinct', () => {
    const registry = new RouteRegistry();
    const publicRoute = route(new RouteAddress({
      surface: 'public', entity: 'product', operation: 'list',
    }));
    const adminRoute = route(new RouteAddress({
      surface: 'admin', entity: 'product', operation: 'list',
    }));

    registry.register(publicRoute);
    registry.register(adminRoute);

    expect(registry.find(publicRoute.address)).toBe(publicRoute);
    expect(registry.find(adminRoute.address)).toBe(adminRoute);
  });

  it('shares system routes across surfaces without widening local routes', () => {
    const registry = new RouteRegistry();
    const system = route(new RouteAddress({ entity: 'rpc', operation: 'discover' }), 'system');
    const local = route(new RouteAddress({ entity: 'product', operation: 'list' }));
    registry.register(system);
    registry.register(local);

    expect(registry.find(new RouteAddress({
      surface: 'admin', entity: 'rpc', operation: 'discover',
    }))).toBe(system);
    expect(registry.find(new RouteAddress({
      surface: 'admin', entity: 'product', operation: 'list',
    }))).toBeUndefined();
  });

  it('refuses two owners for the same address', () => {
    const registry = new RouteRegistry();
    const address = new RouteAddress({ entity: 'product', operation: 'list' });

    registry.register(route(address, 'local'));

    expect(() => registry.register(route(address, 'remote')))
      .toThrow(/product\.list.*local and remote/);
  });

  it('shares an in-progress resolution between equivalent addresses, then caches it', async () => {
    const registry = new RouteRegistry();
    const address = new RouteAddress({ entity: 'product', operation: 'list' });
    const resolved = route(address, 'remote');
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    const resolve = vi.fn(async () => {
      await pending;
      return resolved;
    });
    registry.addResolver({ resolve });

    const first = registry.resolve(address);
    const second = registry.resolve(new RouteAddress(address.toJSON()));
    expect(resolve).toHaveBeenCalledTimes(1);

    finish();
    await expect(Promise.all([first, second]))
      .resolves.toEqual([resolved, resolved]);
    expect(resolve).toHaveBeenCalledTimes(1);
    await expect(registry.resolve(address)).resolves.toBe(resolved);
    expect(resolve).toHaveBeenCalledTimes(1);
  });
});
