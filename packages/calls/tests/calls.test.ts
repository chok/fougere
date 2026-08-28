import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { describe, expect, it, vi } from 'vitest';
import {
  Call,
  DispatchEvent,
  RouteAddress,
  createApp,
  createAppRunner,
  type OrmFactory,
} from '@fougere/core';
import { scanProject } from '@fougere/core/node';
import { CallRing } from '../src/CallRing.js';
import { calls } from '../src/index.js';
import type { CallPage } from '@fougere/core';

const fixtures = join(import.meta.dirname, 'fixtures');
const rows = [{ id: '1', label: 'a first order' }];
const ormFactory: OrmFactory = () => ({
  list: vi.fn(async () => rows),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}) as never;

const callTo = (entity: string, operation: string) =>
  new Call(new RouteAddress({ entity, operation }));

describe('the ring', () => {
  it('folds the five transitions of one call into one record', () => {
    const ring = new CallRing();
    const call = callTo('order', 'list');

    ring.record(DispatchEvent.received(call));
    expect(ring.since(0).calls[0]).toMatchObject({ seq: 1, entity: 'order', operation: 'list', verdict: 'running' });

    ring.record(DispatchEvent.resolved(call, 'remote'));
    ring.record(DispatchEvent.completed(call, 'remote'));
    ring.record(DispatchEvent.settled(call, 'remote'));

    const page = ring.since(0);
    expect(page.calls).toHaveLength(1);
    expect(page.calls[0]).toMatchObject({ route: 'remote', verdict: 'ok' });
    expect(page.calls[0]!.ms).toBeGreaterThanOrEqual(0);
    expect(page.cursor).toBe(1);
  });

  it('keeps a refusal that never reached a handler, and names it', () => {
    const ring = new CallRing();
    const call = callTo('order', 'nope');

    ring.record(DispatchEvent.received(call));
    ring.record(DispatchEvent.failed(call, Object.assign(new Error("No route serves 'order.nope'"), { code: 'NOT_FOUND' })));
    ring.record(DispatchEvent.settled(call));

    const record = ring.since(0).calls[0]!;
    expect(record).toMatchObject({
      verdict: 'failed',
      refusal: { code: 'NOT_FOUND', message: "No route serves 'order.nope'" },
    });
    // No route was ever resolved, so the field is absent rather than guessed.
    expect(record).not.toHaveProperty('route');
  });

  it('ignores the reserved entity, so a reader never watches itself', () => {
    const ring = new CallRing();

    ring.record(DispatchEvent.received(callTo('rpc', 'calls')));

    expect(ring.since(0).calls).toHaveLength(0);
  });

  it('counts what it dropped rather than looking like a quiet period', () => {
    const ring = new CallRing(2);
    for (let i = 0; i < 5; i++) ring.record(DispatchEvent.received(callTo('order', `op${i}`)));

    const page = ring.since(0);
    expect(page.calls.map((one) => one.operation)).toEqual(['op3', 'op4']);
    expect(page.dropped).toBe(3);
    expect(page.cursor).toBe(5);
  });

  it('keeps the traceparent, which is what lets two processes be sewn', () => {
    const ring = new CallRing();
    const call = new Call(
      new RouteAddress({ entity: 'order', operation: 'list' }),
      { trace: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' },
    );

    ring.record(DispatchEvent.received(call));

    expect(ring.since(0).calls[0]).toMatchObject({
      trace: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    });
  });

  it('answers only what a reader has not seen', () => {
    const ring = new CallRing();
    ring.record(DispatchEvent.received(callTo('order', 'first')));
    ring.record(DispatchEvent.received(callTo('order', 'second')));

    expect(ring.since(1).calls.map((one) => one.operation)).toEqual(['second']);
  });
});

describe('the extension', () => {
  it('records what the app dispatched, and serves it as an rpc operation', async () => {
    await using app = await createApp({
      scan: await scanProject(fixtures),
      createContainer,
      ormFactory,
      extensions: [calls()],
    });

    await app.dispatch(callTo('order', 'list'));

    const page = await createAppRunner(app)(
      { entity: 'rpc', op: 'calls' },
      { params: {}, query: {}, body: { since: 0 }, state: {} },
    ) as CallPage;

    expect(page.calls).toHaveLength(1);
    expect(page.calls[0]).toMatchObject({
      frond: 'shop',
      entity: 'order',
      operation: 'list',
      route: 'local',
      verdict: 'ok',
    });
    expect(page.calls[0]).not.toHaveProperty('body');
  });

});
