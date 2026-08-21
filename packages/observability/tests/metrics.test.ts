/**
 * The four signals, and the one property that decides whether a metrics layer survives
 * production: series count must depend on the CODE, never on the traffic.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { join } from 'node:path';
import { createApp } from '@fougere/core';
import type { App, InvocationContext } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { trace, onSpan, metrics, metricsPayload, activeCalls, type Metrics } from '../src/index.js';
// @ts-expect-error plain-JS fixture
import { createOrmFactory } from './fixtures/data.mjs';

const fixturesDir = join(import.meta.dirname, 'fixtures');
type Facade = Record<string, (invocation?: InvocationContext) => Promise<unknown>>;

let app: App;
let measured: Metrics;
let restore: (() => void) | undefined;

beforeAll(async () => {
  app = await createApp({ root: fixturesDir, createContainer, ormFactory: createOrmFactory() });
  app.use(trace());
}, 30_000);

afterEach(() => { restore?.(); restore = undefined; });
afterAll(async () => { await app?.dispose(); });

function collect(): void {
  measured = metrics(app);
  restore = onSpan(measured.sink);
}

describe('rate, errors and duration come from one histogram', () => {
  it('counts calls and sums their time, per op', async () => {
    collect();
    const door = app.resolve<Facade>('productHandler');
    await door.list();
    await door.list();
    await door.findById({ params: { id: 'p1' }, query: {}, body: undefined, state: {} });

    const { series } = measured.snapshot();
    const list = series.find((s) => s.operation === 'list')!;
    expect(list.count).toBe(2);
    expect(list.sum).toBeGreaterThan(0);
    expect(list.buckets.reduce((a, b) => a + b, 0)).toBe(2);
    expect(series.find((s) => s.operation === 'findById')!.count).toBe(1);
  });

  it('separates a refusal into its own series, named by its code', async () => {
    collect();
    const door = app.resolve<Facade>('productHandler');
    await door.list();
    await expect(door.reserve()).rejects.toThrow();

    const { series } = measured.snapshot();
    expect(series.map((s) => [s.operation, s.error])).toEqual(
      expect.arrayContaining([['list', undefined], ['reserve', 'CONFLICT']]),
    );
  });

  it('carries the frond — the unit that gets deployed', async () => {
    collect();
    await app.resolve<Facade>('productHandler').list();

    expect(measured.snapshot().series[0].frond).toBe('catalog');
  });

  /**
   * The mistake a metrics layer cannot recover from. Dimensions are entity × operation ×
   * outcome, all declared in the code — so 50 calls make no more series than 3 do.
   */
  it('does not grow a series per call', async () => {
    collect();
    const door = app.resolve<Facade>('productHandler');
    for (let i = 0; i < 50; i++) await door.list();

    expect(measured.snapshot().series).toHaveLength(1);
  });
});

describe('saturation and topology', () => {
  it('counts nothing as active once every call has returned', async () => {
    collect();
    await app.resolve<Facade>('productHandler').list();
    expect(activeCalls()).toBe(0);
  });

  it('sees a call in flight while it runs', async () => {
    collect();
    const door = app.resolve<Facade>('productHandler');
    const running = door.list();
    expect(activeCalls()).toBe(1);
    await running;
    expect(activeCalls()).toBe(0);
  });

  it('discovers the fronds rather than being told them', async () => {
    collect();
    expect(measured.snapshot().topology).toEqual([
      { frond: 'catalog', placement: 'local', entities: 1, doors: 1 },
    ]);
  });
});

describe('what leaves as OTLP', () => {
  it('publishes both metrics, with cumulative temporality and matching bucket counts', async () => {
    collect();
    await app.resolve<Facade>('productHandler').list();

    const body = metricsPayload('catalog', measured.snapshot());
    const published = body.resourceMetrics[0].scopeMetrics[0].metrics;
    // No edges here — one process, one frond — and the edge metrics are therefore absent
    // rather than empty. See the emptiness test below for why that matters.
    expect(published.map((m) => m.name)).toEqual([
      'fougere.operation.duration',
      'fougere.operations.active',
      'fougere.fronds',
      'fougere.frond.doors',
    ]);

    const histogram = published[0].histogram!;
    expect(histogram.aggregationTemporality).toBe(2);
    const point = histogram.dataPoints[0];
    // OTLP requires exactly one more bucket than there are bounds.
    expect(point.bucketCounts).toHaveLength(point.explicitBounds.length + 1);
    expect(point.attributes.map((a: { key: string }) => a.key)).toEqual(
      expect.arrayContaining(['fougere.frond', 'fougere.entity', 'fougere.operation', 'fougere.outcome']),
    );
  });

  /**
   * Measured against a real Prometheus: a metric carrying zero data points makes it
   * answer 500 and drop the ENTIRE payload — so one absent edge silently cost every
   * other metric in the same batch.
   */
  it('never publishes a metric with no data points', async () => {
    collect();
    await app.resolve<Facade>('productHandler').list();

    const published = metricsPayload('catalog', measured.snapshot())
      .resourceMetrics[0].scopeMetrics[0].metrics as Array<Record<string, any>>;

    for (const metric of published) {
      const points = (metric.histogram ?? metric.gauge ?? metric.sum).dataPoints;
      expect(points.length, `${metric.name} was published empty`).toBeGreaterThan(0);
    }
  });
});
