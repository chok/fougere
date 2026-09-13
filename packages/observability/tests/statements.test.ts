/**
 * What runs UNDER an operation, and the subtraction it makes possible.
 *
 * A statement is not dispatched, so nothing wraps a middleware around it: it reaches the step
 * in flight through the async context the tracer already opened, which is the whole join. What
 * it buys is the one figure a duration cannot give — whether an op is slow or merely waiting.
 */
import { scanProject } from '@fougere/compiler';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { join } from 'node:path';
import { createApp } from '@fougere/core';
import type { App, InvocationContext } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { tracing, metrics, type FinishedSpan, type SpanSink, type Tracing } from '../src/index.js';
import { createStorageFactory } from './fixtures/data.js';

const fixturesDir = join(import.meta.dirname, 'fixtures');
type Facade = Record<string, (invocation?: InvocationContext) => Promise<unknown>>;

let app: App;
let tracer: Tracing;
const takers: SpanSink[] = [];
let spans: FinishedSpan[] = [];

/** How long the next call reports each of its statements. Emptied between tests. */
let running: number[] = [];
/** Long enough that a statement of 5 ms is a fraction of the op, whatever the machine. */
const SLOW = 30;

beforeAll(async () => {
  app = await createApp({
    scan: await scanProject(fixturesDir),
    createContainer,
    storageFactory: createStorageFactory(),
  });
  tracer = tracing(takers, { spanPerStatement: true });
  app.use(tracer.middleware);
  // Installed AFTER the tracer, so it runs INSIDE the span — where a Kysely sink runs.
  app.use(async (_ctx, next) => {
    await new Promise((wake) => setTimeout(wake, SLOW));
    for (const ms of running) {
      tracer.statement({ subject: 'product', verb: 'select', ms, failed: false });
    }

    return next();
  });
}, 30_000);

afterEach(() => { takers.length = 0; running = []; });
afterAll(async () => { await app?.dispose(); });

function collect(): void {
  spans = [];
  takers.push((span) => spans.push(span));
}

const operations = () => spans.filter((span) => span.kind === 'operation');
const statements = () => spans.filter((span) => span.kind === 'statement');

describe('a statement belongs to the step it ran under', () => {
  it('is a child of the operation, in the same trace', async () => {
    collect();
    running = [5];
    await app.resolve<Facade>('productHandler').list();

    const [op] = operations();
    const [ran] = statements();
    expect(ran.parentId).toBe(op.spanId);
    expect(ran.traceId).toBe(op.traceId);
    expect(ran.frond).toBe(op.frond);
    // The label a viewer draws: the table it touched, and what it did to it.
    expect(`${ran.entity}.${ran.operation}`).toBe('product.select');
  });

  it('never begins before the operation that issued it', async () => {
    collect();
    running = [5];
    await app.resolve<Facade>('productHandler').list();

    const [op] = operations();
    const [ran] = statements();
    // Two clocks: the op takes `Date.now()` at its start, a statement subtracts microseconds
    // from a `Date.now()` taken at its end. A millisecond of rounding drew six queries to the
    // LEFT of their parent in a real viewer.
    expect(ran.startedAt).toBeGreaterThanOrEqual(op.startedAt);
  });

  it('opens nothing when no operation is in flight', () => {
    collect();
    tracer.statement({ subject: 'product', verb: 'select', ms: 5, failed: false });

    // A migration and a seed both run here. Giving them a trace of their own would put one
    // root span in the viewer per row planted.
    expect(spans).toEqual([]);
  });
});

describe('what a statement took is taken out of the step that waited for it', () => {
  it('deducts the time and counts the statements', async () => {
    collect();
    running = [5, 5];
    await app.resolve<Facade>('productHandler').list();

    const [op] = operations();
    expect(op.statements).toBe(2);
    expect(op.ms).toBeGreaterThanOrEqual(SLOW);
    expect(op.ms - op.selfMs).toBeCloseTo(10, 5);
  });

  it('reports no self time rather than a negative one', async () => {
    collect();
    // Four queries behind one `Promise.all` add up to more than the op that holds them.
    running = [SLOW, SLOW, SLOW, SLOW];
    await app.resolve<Facade>('productHandler').list();

    const [op] = operations();
    expect(op.selfMs).toBe(0);
  });

  it('leaves a statement its whole time — it delegates to nothing observed', async () => {
    collect();
    running = [5];
    await app.resolve<Facade>('productHandler').list();

    const [ran] = statements();
    expect(ran.selfMs).toBe(ran.ms);
    expect(ran.statements).toBe(0);
  });
});

/**
 * The default, and the split it draws: the COUNT detects and runs always, the DETAIL
 * explains and is turned on over the op the count named. What decides is not the CPU — a
 * statement span is 658 ns against a 14 µs query — but the volume: a backend charges per
 * span, and a page of forty rows exports forty of them.
 */
describe('a statement is charged upward without a span of its own', () => {
  const kept: FinishedSpan[] = [];
  const quiet = tracing([(span) => kept.push(span)]);
  const call = (ran: number[]) => quiet.middleware(
    { entity: 'product', operation: 'list', args: [], state: {} },
    async () => {
      await new Promise((wake) => setTimeout(wake, SLOW));
      for (const ms of ran) quiet.statement({ subject: 'product', verb: 'select', ms, failed: false });

      return 'answered';
    },
  );

  it('reports the same self time and the same count, and exports one span', async () => {
    kept.length = 0;
    await call([5, 5, 5]);

    expect(kept).toHaveLength(1);
    expect(kept[0].kind).toBe('operation');
    expect(kept[0].statements).toBe(3);
    expect(kept[0].ms - kept[0].selfMs).toBeCloseTo(15, 5);
  });
});

describe('the one reader that has to choose', () => {
  it('counts operations and never the statements under them', async () => {
    collect();
    const measured = metrics(app);
    takers.push(measured.sink);
    running = [5, 5, 5];
    await app.resolve<Facade>('productHandler').list();

    const { series } = measured.snapshot();
    // `product.select` is not an operation this process answers: published as one, it would
    // appear in the topology, in the saturation figure and in every rate built on them.
    expect(series.map((row) => `${row.entity}.${row.operation}`)).toEqual(['product.list']);
    expect(series[0].count).toBe(1);
    expect(series[0].statements).toBe(3);
  });
});
