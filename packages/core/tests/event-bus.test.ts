import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../src/index.js';

describe('EventBus', () => {
  it('calls handler when event is emitted', async () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('orderPlaced', handler);
    await bus.emit('orderPlaced', { orderId: '1' });

    expect(handler).toHaveBeenCalledWith({ orderId: '1' });
  });

  it('supports multiple handlers for same event', async () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on('orderPlaced', h1);
    bus.on('orderPlaced', h2);
    await bus.emit('orderPlaced', { orderId: '1' });

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('does nothing when emitting event with no listeners', async () => {
    const bus = new EventBus();
    await expect(bus.emit('unknown')).resolves.toBeUndefined();
  });

  it('unsubscribe removes the handler', async () => {
    const bus = new EventBus();
    const handler = vi.fn();

    const off = bus.on('orderPlaced', handler);
    off();
    await bus.emit('orderPlaced', { orderId: '1' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('clear removes all listeners', async () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on('a', h1);
    bus.on('b', h2);
    bus.clear();

    await bus.emit('a');
    await bus.emit('b');

    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('handles async handlers', async () => {
    const bus = new EventBus();
    const order: string[] = [];

    bus.on('test', async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push('async');
    });
    bus.on('test', () => {
      order.push('sync');
    });

    await bus.emit('test');
    expect(order).toContain('async');
    expect(order).toContain('sync');
  });

  it('emit without payload passes undefined', async () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('ping', handler);
    await bus.emit('ping');

    expect(handler).toHaveBeenCalledWith(undefined);
  });

  it('is registered as builtin in createApp', async () => {
    const { createApp } = await import('../src/index.js');
    const { createContainer } = await import('@fougere/container-fougere');

    const app = await createApp({
      root: '/tmp/nonexistent-fougere-test',
      createContainer,
    });

    expect(app.container.has('EventBus')).toBe(true);
    const bus = app.resolve<EventBus>('EventBus');
    expect(bus).toBeInstanceOf(EventBus);

    await app.dispose();
  });
});
