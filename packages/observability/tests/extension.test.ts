/**
 * The package as one member of an app's ascent — and the defect that made the pair worth
 * declaring: `onSpan` already RETURNED its withdrawal, and nothing ever called it.
 */
import { scanProject } from '@fougere/core/node';
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createApp, createLocalRunner } from '@fougere/core';
import type { InvocationContext } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { observability, trace, activeCalls, flushTelemetry, registerFlush } from '../src/index.js';
// @ts-expect-error plain-JS fixture
import { createOrmFactory } from './fixtures/data.mjs';

const fixturesDir = join(import.meta.dirname, 'fixtures');
const EMPTY: InvocationContext = { params: {}, query: {}, body: undefined, state: {} };
type Facade = Record<string, (invocation?: InvocationContext) => Promise<unknown>>;

const scan = await scanProject(fixturesDir);
const boot = (extensions: Parameters<typeof createApp>[0]['extensions']) => createApp({
  scan, createContainer, ormFactory: createOrmFactory(), extensions,
});

describe('observability as an extension', () => {
  it('wires itself and answers rpc.topology, with nothing declared by the host', async () => {
    await using app = await boot([observability()]);

    expect(app.extensions()).toContain('observability');
    const report = await createLocalRunner(app)({ entity: 'rpc', op: 'topology' }, EMPTY) as {
      fronds: Array<{ frond: string; placement: string }>;
    };
    expect(report.fronds).toEqual([{ frond: 'catalog', placement: 'local', entities: 1, doors: 1 }]);
  });

  /**
   * The reload shape: a host declares its extensions ONCE (`configureFougere`), so the same
   * instance goes up on the new app before the old one is released. Withdrawals kept on the
   * instance rather than per app made the old app's release take down the new app's — after
   * which the panel still answers and every counter stays frozen.
   */
  it('keeps each app\'s withdrawals apart when one instance serves two', async () => {
    const declared = observability();
    const first = await boot([declared]);
    const second = await boot([declared]);

    await first.dispose();

    // The second app is still observed: its own sink was never withdrawn.
    const running = second.resolve<Facade>('productHandler').list();
    expect(activeCalls()).toBe(1);
    await running;
    await second.dispose();
  });

  /**
   * The one that bites only once apps are discarded on purpose: a released app whose sink
   * is still registered keeps accumulating from the app that replaced it, so every metric
   * counts twice and nothing says so.
   */
  it('withdraws its sink on release, so a discarded app stops observing', async () => {
    const first = await boot([observability()]);
    const door = first.resolve<Facade>('productHandler');
    const running = door.list();
    // A sink is registered, so `trace()` opens a span and the call is counted.
    expect(activeCalls()).toBe(1);
    await running;

    await first.dispose();

    // Same middleware, no extension: it opens nothing because nothing is listening. With
    // the sink left behind, this would count — which is exactly the double-counting.
    await using second = await boot(undefined);
    second.use(trace());
    const secondRunning = second.resolve<Facade>('productHandler').list();
    expect(activeCalls()).toBe(0);
    await secondRunning;
  });
});

describe('sending what is buffered, now', () => {
  it('a flush with nothing registered is not an error', async () => {
    // A host calls `ctx.waitUntil(flushTelemetry())` unconditionally — it cannot know
    // whether the deployment configured an exporter, and asking would be its business.
    await expect(flushTelemetry()).resolves.toBeUndefined();
  });

  it('asks every exporter, and reports the refusals together', async () => {
    // An isolate is frozen when it answers, so the timer an exporter relies on never
    // fires. Every one is asked: a flush that abandons the rest loses the windows after it.
    const asked: string[] = [];
    const undo = [
      registerFlush(async () => { asked.push('traces'); }),
      registerFlush(async () => { asked.push('logs'); throw new Error('collector down'); }),
      registerFlush(async () => { asked.push('metrics'); }),
    ];

    await expect(flushTelemetry()).rejects.toThrow(AggregateError);
    expect(asked).toEqual(['traces', 'logs', 'metrics']);

    for (const stop of undo) stop();
  });

  it('withdraws, so a released app stops being asked', async () => {
    let asked = 0;
    const stop = registerFlush(async () => { asked += 1; });
    await flushTelemetry();
    stop();
    await flushTelemetry();

    expect(asked).toBe(1);
  });
});
