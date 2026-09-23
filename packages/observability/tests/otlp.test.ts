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
});
