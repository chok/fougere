import { describe, expect, it, vi } from 'vitest';
import { Call } from '../src/contract/Call.js';
import { RouteAddress } from '../src/contract/RouteAddress.js';
import type { DispatchEvent } from '../src/dispatch/DispatchEvent.js';
import { DispatchLifecycle } from '../src/dispatch/DispatchLifecycle.js';
import { Dispatcher } from '../src/dispatch/Dispatcher.js';
import type { Route } from '../src/dispatch/Route.js';
import { RouteRegistry } from '../src/dispatch/RouteRegistry.js';
import { ErrorCode } from '../src/wire/errors.js';

function setup(execute: Route['execute']) {
  const address = new RouteAddress({ entity: 'product', operation: 'list' });
  const route: Route = { kind: 'local', address, execute };
  const routes = new RouteRegistry();
  const events: DispatchEvent[] = [];
  routes.register(route);
  return {
    call: new Call(address),
    dispatcher: new Dispatcher(routes, new DispatchLifecycle([(event) => events.push(event)])),
    events,
  };
}

describe('Dispatcher', () => {
  it('resolves and executes through one lifecycle', async () => {
    const execute = vi.fn(async () => ['fern']);
    const { call, dispatcher, events } = setup(execute);

    await expect(dispatcher.dispatch(call)).resolves.toEqual(['fern']);

    expect(execute).toHaveBeenCalledWith(call);
    expect(events.map(({ stage }) => stage))
      .toEqual(['received', 'resolved', 'completed', 'settled']);
    expect(events.every(Object.isFrozen)).toBe(true);
  });

  it('observes resolution failures and always settles', async () => {
    const events: DispatchEvent[] = [];
    const dispatcher = new Dispatcher(
      new RouteRegistry(),
      new DispatchLifecycle([(event) => events.push(event)]),
    );
    const call = new Call(new RouteAddress({ entity: 'missing', operation: 'list' }));

    await expect(dispatcher.dispatch(call)).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
      entity: 'missing',
      operation: 'list',
    });
    expect(events.map(({ stage }) => stage)).toEqual(['received', 'failed', 'settled']);
  });

  it('observes execution failures without rewriting them', async () => {
    const failure = new Error('storage unavailable');
    const { dispatcher, call, events } = setup(async () => { throw failure; });

    await expect(dispatcher.dispatch(call)).rejects.toBe(failure);
    expect(events.map(({ stage }) => stage))
      .toEqual(['received', 'resolved', 'failed', 'settled']);
    expect(events.find(({ stage }) => stage === 'failed')).toMatchObject({ error: failure });
  });

  it('does not let an observer alter the dispatch result', async () => {
    const address = new RouteAddress({ entity: 'product', operation: 'count' });
    const routes = new RouteRegistry();
    routes.register({ kind: 'system', address, execute: async () => 2 });
    const lifecycle = new DispatchLifecycle([() => { throw new Error('metrics failed'); }]);

    await expect(new Dispatcher(routes, lifecycle).dispatch(new Call(address))).resolves.toBe(2);
  });
});
