import { describe, expect, it, vi } from 'vitest';
import { Call } from '../src/contract/Call.js';
import { RouteAddress } from '../src/contract/RouteAddress.js';
import type { DispatchEvent } from '../src/dispatch/DispatchEvent.js';
import { DispatchLifecycle } from '../src/dispatch/DispatchLifecycle.js';
import { Dispatcher } from '../src/dispatch/Dispatcher.js';
import type { Route } from '../src/dispatch/Route.js';
import { RouteRegistry } from '../src/dispatch/RouteRegistry.js';
import { InFlight } from '../src/dispatch/InFlight.js';
import { ErrorCode } from '../src/wire/errors.js';

function setup(execute: Route['execute']) {
  const address = new RouteAddress({ entity: 'product', operation: 'list' });
  const route: Route = { kind: 'local', address, execute };
  const routes = new RouteRegistry();
  const events: DispatchEvent[] = [];
  const inFlight = new InFlight();
  routes.register(route);
  return {
    call: new Call(address),
    dispatcher: new Dispatcher(
      routes,
      inFlight,
      new DispatchLifecycle([(event) => events.push(event)]),
    ),
    events,
    inFlight,
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
      new InFlight(),
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

  it('owns admission for the whole route execution', async () => {
    let finish!: (value: string) => void;
    const execution = new Promise<string>((resolve) => { finish = resolve; });
    const { dispatcher, call, inFlight } = setup(() => execution);

    const result = dispatcher.dispatch(call);
    expect(inFlight.count).toBe(1);

    finish('done');
    await expect(result).resolves.toBe('done');
    expect(inFlight.count).toBe(0);
  });

  it('observes a call refused by closed admission', async () => {
    const events: DispatchEvent[] = [];
    const inFlight = new InFlight();
    inFlight.close();
    const dispatcher = new Dispatcher(
      new RouteRegistry(),
      inFlight,
      new DispatchLifecycle([(event) => events.push(event)]),
    );

    await expect(dispatcher.dispatch(new Call(
      new RouteAddress({ entity: 'product', operation: 'list' }),
    ))).rejects.toMatchObject({ code: ErrorCode.SERVICE_UNAVAILABLE });
    expect(events.map(({ stage }) => stage)).toEqual(['received', 'failed', 'settled']);
    expect(inFlight.count).toBe(0);
  });

  it('does not let an observer alter the dispatch result', async () => {
    const address = new RouteAddress({ entity: 'product', operation: 'count' });
    const routes = new RouteRegistry();
    routes.register({ kind: 'system', address, execute: async () => 2 });
    const failure = new Error('metrics failed');
    const diagnose = vi.fn();
    const lifecycle = new DispatchLifecycle([() => { throw failure; }], diagnose);

    await expect(new Dispatcher(routes, new InFlight(), lifecycle).dispatch(new Call(address))).resolves.toBe(2);
    expect(diagnose).toHaveBeenCalledTimes(4);
    expect(diagnose).toHaveBeenCalledWith(failure, expect.objectContaining({ stage: 'received' }));
  });
});
