import { describe, it, expect, vi, afterEach } from 'vitest';
import { otlp } from '../src/index.js';

afterEach(() => vi.unstubAllGlobals());

describe('a span on the wire', () => {
  it('carries what a reader groups by, under the names OpenTelemetry gives them', async () => {
    const posted: unknown[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      posted.push(JSON.parse(init.body));

      return new Response('{}');
    });
    const exporter = otlp({ service: 'shop', url: 'http://collector/v1/traces', flushMs: 0 });

    exporter.sink({
      traceId: '0'.repeat(32), spanId: '1'.repeat(16), parentId: undefined, sampled: true,
      callerFrond: 'shop', frond: 'catalog', kind: 'operation', entity: 'product', operation: 'list',
      startedAt: 1, ms: 2, selfMs: 1, statements: 3, error: undefined,
    } as never);
    await exporter.flush();

    const span = (posted[0] as { resourceSpans: { scopeSpans: { spans: { attributes: { key: string; value: Record<string, string> }[] }[] }[] }[] })
      .resourceSpans[0]!.scopeSpans[0]!.spans[0]!;
    const attributes = Object.fromEntries(span.attributes.map(({ key, value }) => [key, Object.values(value)[0]]));

    expect(attributes).toEqual({
      'rpc.system': 'fougere',
      'rpc.service': 'product',
      'rpc.method': 'list',
      'fougere.frond': 'catalog',
      'fougere.caller_frond': 'shop',
      'fougere.statements': '3',
    });
    exporter.stop();
  });

  it('draws a hop as the CLIENT that sent it and the SERVER that received it', async () => {
    const posted: { resourceSpans: { scopeSpans: { spans: { kind: number }[] }[] }[] }[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      posted.push(JSON.parse(init.body));

      return new Response('{}');
    });
    const exporter = otlp({ service: 'shop', url: 'http://collector/v1/traces', flushMs: 0 });
    const span = (kind: 'operation' | 'statement', crossing: 'sent' | 'received' | undefined) => ({
      traceId: '0'.repeat(32), spanId: '1'.repeat(16), parentId: undefined, sampled: true, callerFrond: undefined,
      frond: 'catalog', kind, crossing, entity: 'product', operation: 'list', startedAt: 1, ms: 2, selfMs: 1,
      statements: 0, error: undefined,
    }) as never;

    for (const one of [span('operation', 'sent'), span('operation', 'received'), span('operation', undefined), span('statement', undefined)]) {
      exporter.sink(one);
    }
    await exporter.flush();

    expect(posted[0]!.resourceSpans[0]!.scopeSpans[0]!.spans.map((one) => one.kind)).toEqual([3, 2, 1, 3]);
    exporter.stop();
  });
});
