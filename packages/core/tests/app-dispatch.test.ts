import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { describe, expect, it, vi } from 'vitest';
import {
  Call,
  RouteAddress,
  createApp,
  createAppRunner,
  createLocalRunner,
  type DispatchEvent,
  type StorageFactory,
} from '../src/index.js';
import { scanProject } from '../src/node.js';
import { EMPTY_INVOCATION } from '../src/contract/Invocation.js';

const fixtures = join(import.meta.dirname, 'fixtures');
const rows = [{ id: '1', name: 'Fern', price: 12.5 }];
const storageFactory: StorageFactory = () => ({
  list: vi.fn(async () => rows),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}) as never;

describe('App.dispatch', () => {
  it('executes a local route through the transverse lifecycle', async () => {
    const events: DispatchEvent[] = [];
    await using app = await createApp({
      scan: await scanProject(fixtures),
      createContainer,
      storageFactory,
      dispatchObservers: [(event) => events.push(event)],
    });
    const call = new Call(new RouteAddress({ entity: 'product', operation: 'list' }));

    await expect(app.dispatch(call)).resolves.toMatchObject([{ id: '1', name: 'Fern' }]);
    expect(events.map(({ stage }) => stage))
      .toEqual(['received', 'resolved', 'completed', 'settled']);
    expect(events.find(({ stage }) => stage === 'resolved')).toMatchObject({ routeKind: 'local' });
  });

  it('lets a late subscriber watch, and stop watching', async () => {
    const seen: string[] = [];
    await using app = await createApp({
      scan: await scanProject(fixtures),
      createContainer,
      storageFactory,
    });

    // `app.use` adds a middleware this late; this is its dual — participate, or watch.
    const stop = app.observe((event) => seen.push(event.stage));
    await app.dispatch(new Call(new RouteAddress({ entity: 'product', operation: 'list' })));
    expect(seen).toEqual(['received', 'resolved', 'completed', 'settled']);

    stop();
    await app.dispatch(new Call(new RouteAddress({ entity: 'product', operation: 'list' })));
    expect(seen).toHaveLength(4);
  });

  it('makes createAppRunner an entry over the same dispatcher', async () => {
    const events: DispatchEvent[] = [];
    await using app = await createApp({
      scan: await scanProject(fixtures),
      createContainer,
      storageFactory,
      dispatchObservers: [(event) => events.push(event)],
    });

    await createAppRunner(app)({ entity: 'product', op: 'list' }, EMPTY_INVOCATION);

    expect(events.map(({ stage }) => stage))
      .toEqual(['received', 'resolved', 'completed', 'settled']);
  });

  it('shares a system route with every surface', async () => {
    const events: DispatchEvent[] = [];
    await using app = await createApp({
      scan: await scanProject(fixtures),
      createContainer,
      storageFactory,
      dispatchObservers: [(event) => events.push(event)],
    });

    await createAppRunner(app, 'admin')(
      { entity: 'rpc', op: 'discover' },
      EMPTY_INVOCATION,
    );

    expect(events.find(({ stage }) => stage === 'resolved')).toMatchObject({ routeKind: 'system' });
  });

  it('keeps incoming transports local without a second dispatch engine', async () => {
    const transport = vi.fn(async () => ['remote']);
    await using app = await createApp({
      scan: await scanProject('/tmp/fougere-app-dispatch-empty'),
      createContainer,
      remotes: { catalog: 'stub://catalog' },
      remoteTransport: () => transport,
    });

    await expect(createLocalRunner(app)(
      { entity: 'product', op: 'list' },
      EMPTY_INVOCATION,
    )).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(transport).not.toHaveBeenCalled();
  });
});
