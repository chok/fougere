/**
 * The third signal, and the property that makes it one: a line written inside a call
 * leaves with that call's trace id. Without it, exporting logs only moves them.
 */
import { scanProject } from '@fougere/core/node';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { createApp, Logger, onLog, setLogLevel } from '@fougere/core';
import type { App, InvocationContext, LogRecord } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { trace, onSpan, logs, currentSpan, type FinishedSpan } from '../src/index.js';
// @ts-expect-error plain-JS fixture
import { createStorageFactory } from './fixtures/data.mjs';

const fixturesDir = join(import.meta.dirname, 'fixtures');
type Facade = Record<string, (invocation?: InvocationContext) => Promise<unknown>>;

let app: App;
const undo: (() => void)[] = [];

beforeAll(async () => {
  app = await createApp({ scan: await scanProject(fixturesDir), createContainer, storageFactory: createStorageFactory() });
  app.use(trace());
}, 30_000);

afterEach(() => { while (undo.length) undo.pop()!(); vi.restoreAllMocks(); setLogLevel('info'); });
afterAll(async () => { await app?.dispose(); });

/** Every record the logger emits, in order. */
function captured(): LogRecord[] {
  const seen: LogRecord[] = [];
  undo.push(onLog((r) => seen.push(r)));
  return seen;
}

describe('the logger has a door', () => {
  it('hands out a structured record, not a formatted line', () => {
    const seen = captured();
    vi.spyOn(console, 'info').mockImplementation(() => {});

    new Logger('boot:app').info('scanned %s fronds', 3);

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ level: 'info', name: 'boot:app', message: 'scanned %s fronds', args: [3] });
    expect(seen[0].at).toBeGreaterThan(0);
  });

  it('respects the level — a filtered line is never forwarded either', () => {
    const seen = captured();
    setLogLevel('warn');
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const log = new Logger('app');
    log.info('quiet');
    log.warn('loud');

    expect(seen.map((r) => r.level)).toEqual(['warn']);
  });

  it('keeps writing to the console — forwarding is an addition', () => {
    captured();
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    new Logger('app').warn('still printed');

    expect(spy).toHaveBeenCalledOnce();
  });

  it('sends each level to its own console method', () => {
    const methods = (['debug', 'info', 'warn', 'error'] as const)
      .map((m) => [m, vi.spyOn(console, m).mockImplementation(() => {})] as const);
    setLogLevel('debug');

    const log = new Logger('app');
    log.debug('d'); log.info('i'); log.warn('w'); log.error('e');

    for (const [name, spy] of methods) expect(spy, name).toHaveBeenCalledOnce();
  });

  it('survives a sink that throws', () => {
    undo.push(onLog(() => { throw new Error('broken exporter'); }));
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    expect(() => new Logger('app').info('fine')).not.toThrow();
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe('a line carries the call it was written inside', () => {
  it('stamps the trace of the operation running around it', async () => {
    const spans: FinishedSpan[] = [];
    undo.push(onSpan((s) => spans.push(s)));

    const exporter = logs({ service: 'catalog' });
    const sent: { traceId?: string }[] = [];
    undo.push(onLog((r) => { exporter.sink(r); }));
    vi.spyOn(console, 'info').mockImplementation(() => {});

    // A handler logging in the middle of its own operation. `app.use` cannot be undone,
    // so the middleware is installed once and gated — it must not leak into other tests.
    const log = new Logger('handler');
    let watching = true;
    undo.push(() => { watching = false; });
    app.use('product', async (_ctx, next) => {
      if (watching) {
        log.info('about to list');
        sent.push({ traceId: currentSpan()?.traceId });
      }
      return next();
    });

    await app.resolve<Facade>('productHandler').list();

    expect(spans).toHaveLength(1);
    expect(sent[0].traceId).toBe(spans[0].traceId);
  });

  it('leaves a boot line with no trace rather than a forged one', () => {
    const exporter = logs({ service: 'catalog' });
    const kept: { traceId: string | undefined }[] = [];
    undo.push(onLog((r) => {
      exporter.sink(r);
      kept.push({ traceId: currentSpan()?.traceId });
    }));
    vi.spyOn(console, 'info').mockImplementation(() => {});

    new Logger('boot').info('booting');

    expect(kept[0].traceId).toBeUndefined();
  });
});
