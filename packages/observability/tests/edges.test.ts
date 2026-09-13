/**
 * The service graph, both halves.
 *
 * `edges` is COUNTED where a call was made, `declared` is READ from the config and the scan.
 * They answer different questions and the difference is the point: a frond that never
 * answered is absent from the counted half, so a system with a node down reports as a smaller
 * healthy system. Until now nothing pinned either — the only edge assertions in this package
 * were `toEqual([])`, from a fixture that had one frond and could not produce one.
 */
import { scanProject } from '@fougere/compiler';
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createApp, createLocalRunner } from '@fougere/core';
import type { App, InvocationContext, TopologyReport } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { tracing, metrics, type Metrics, type SpanSink } from '../src/index.js';
import { serveTopology } from '../src/metrics/Metrics.js';

const fixturesDir = join(import.meta.dirname, 'fixtures-edge');
const empty: InvocationContext = { params: {}, query: {}, input: undefined, state: {} };

/** An app over the two-frond fixture, with its spans already taken. */
async function watched(remotes?: Record<string, string>): Promise<{ app: App; measured: Metrics }> {
  const app = await createApp({
    scan: await scanProject(fixturesDir),
    createContainer,
    ...(remotes ? { remotes, remoteTransport: () => (async () => 3) } : {}),
  });
  const measured = metrics(app);
  const takers: SpanSink[] = [measured.sink];
  app.use(tracing(takers).middleware);

  return { app, measured };
}

const topologyOf = async (app: App): Promise<TopologyReport> =>
  await createLocalRunner(app)({ entity: 'rpc', op: 'topology' }, empty) as TopologyReport;

describe('the edge that is counted', () => {
  it('names both ends when one frond reaches another', async () => {
    const { app, measured } = await watched();
    await using held = app;
    await createLocalRunner(held)({ entity: 'cart', op: 'servable' }, empty);

    expect(measured.snapshot().edges).toEqual([
      { from: 'shop', to: 'catalog', count: 1, errors: 0 },
    ]);
  }, 30_000);
});

describe('the edge that is declared', () => {
  it('names a frond the config moved out, address reduced to host and port', async () => {
    const { app, measured } = await watched({ catalog: 'http://carrier:hidden@127.0.0.1:4100/rpc' });
    await using held = app;
    serveTopology(held, measured);

    const report = await topologyOf(held);

    expect(report.declared.fronds).toContainEqual({
      frond: 'catalog',
      placement: 'remote',
      at: 'http://127.0.0.1:4100',
    });
    expect(report.declared.edges).toEqual([{ from: 'shop', to: 'catalog' }]);
  }, 30_000);

  /**
   * The whole reason it travels. Before a single call the counted half knows only what this
   * process scanned, and a reader would conclude it stands alone; the declared half already
   * names the neighbour, so a node that never answers is a dead edge rather than an absence.
   *
   * The `fronds` line caught the first disagreement the day the two halves were put side by
   * side: a frond whose code sits in the same project is SCANNED, so `remotes:` leaves it in
   * `app.fronds`, and the counted half answered `local` for a frond every call reached over
   * HTTP. It is named there now only once it has answered, like any other remote.
   */
  it('names the neighbour before any call has been made', async () => {
    const { app, measured } = await watched({ catalog: 'http://127.0.0.1:4100' });
    await using held = app;
    serveTopology(held, measured);

    const report = await topologyOf(held);

    expect(report.edges).toEqual([]);
    expect(report.fronds.map((one) => one.frond)).not.toContain('catalog');
    expect(report.declared.edges).toEqual([{ from: 'shop', to: 'catalog' }]);
  }, 30_000);

  it('survives JSON unchanged, like every other field of a wire document', async () => {
    const { app, measured } = await watched();
    await using held = app;
    serveTopology(held, measured);

    const report = await topologyOf(held);

    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  }, 30_000);
});
