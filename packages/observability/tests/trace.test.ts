/**
 * One call, one trace — over anything.
 *
 * Both receivers here listen on real sockets, so the async context never crosses: two
 * halves landing under one trace-id proves the WIRE carried it. The socket receiver has
 * no headers at all and still carries it, which is the whole point — the trace rides the
 * invocation, and every transport carries the invocation.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createServer, connect, type Server } from 'node:net';
import { join } from 'node:path';
import { createApp, createLocalRunner } from '@fougere/core';
import type { App, InvocationContext, Transport } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { serve, createHttpTransport, handleRpc, frameCall, unframeResponse } from '@fougere/transport-http';
import type { RunningReceiver, RpcResponse } from '@fougere/transport-http';
import { trace, onSpan, type FinishedSpan } from '../src/index.js';
// @ts-expect-error plain-JS fixture
import { createOrmFactory } from './fixtures/data.mjs';

const fixturesDir = join(import.meta.dirname, 'fixtures');
type Facade = Record<string, (invocation?: InvocationContext) => Promise<unknown>>;

/** A receiver with no envelope at all — one call per connection, nowhere to put a header. */
function serveSocket(runner: Transport): Promise<{ port: number; server: Server }> {
  // Half-open: the caller ends its side to say "that is the whole request", and the
  // answer still has somewhere to go.
  const server = createServer({ allowHalfOpen: true }, (socket) => {
    let raw = '';
    socket.on('data', (chunk) => { raw += chunk.toString('utf8'); });
    socket.on('end', async () => {
      socket.end(JSON.stringify(await handleRpc(runner, JSON.parse(raw))));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ port: typeof address === 'object' && address ? address.port : 0, server });
    });
  });
}

function socketTransport(port: number): Transport {
  return (call, invocation) =>
    new Promise((resolve, reject) => {
      const socket = connect(port, '127.0.0.1');
      let raw = '';
      socket.on('data', (chunk) => { raw += chunk.toString('utf8'); });
      socket.on('error', reject);
      socket.on('end', () => {
        try { resolve(unframeResponse(JSON.parse(raw) as RpcResponse, call)); }
        catch (err) { reject(err); }
      });
      socket.write(JSON.stringify(frameCall(call, invocation, 1)));
      socket.end();
    });
}

let host: App;
let receiver: RunningReceiver;
let socket: { port: number; server: Server };
let overHttp: App;
let overSocket: App;
let restore: (() => void) | undefined;
let spans: FinishedSpan[] = [];

function collect(): void {
  spans = [];
  restore = onSpan((span) => spans.push(span));
}

/** The caller's span and the receiver's, told apart by which one has no parent. */
function halves(): [FinishedSpan, FinishedSpan] {
  return spans[0].parentId === undefined ? [spans[0], spans[1]] : [spans[1], spans[0]];
}

beforeAll(async () => {
  host = await createApp({ root: fixturesDir, createContainer, ormFactory: createOrmFactory() });
  host.use(trace());
  const runner = createLocalRunner(host);

  receiver = await serve(runner, { port: 0 });
  socket = await serveSocket(runner);

  overHttp = await createApp({
    root: '/tmp/fougere-trace-http',
    createContainer,
    remotes: { catalog: `http://127.0.0.1:${receiver.port}` },
    remoteTransport: (url) => createHttpTransport(url),
  });
  overHttp.use(trace());

  overSocket = await createApp({
    root: '/tmp/fougere-trace-socket',
    createContainer,
    remotes: { catalog: `tcp://127.0.0.1:${socket.port}` },
    remoteTransport: () => socketTransport(socket.port),
  });
  overSocket.use(trace());
}, 30_000);

afterEach(() => { restore?.(); restore = undefined; });

afterAll(async () => {
  socket?.server.close();
  await receiver?.close();
  await overHttp?.dispose();
  await overSocket?.dispose();
  await host?.dispose();
});

describe('a span per operation', () => {
  it('opens none when nobody listens', async () => {
    spans = [];
    await host.resolve<Facade>('productHandler').list();
    expect(spans).toEqual([]);
  });

  it('names the op, its duration and its verdict', async () => {
    collect();
    await host.resolve<Facade>('productHandler').list();
    await expect(host.resolve<Facade>('productHandler').reserve()).rejects.toThrow();

    expect(spans.map((s) => [s.entity, s.operation, s.error])).toEqual([
      ['product', 'list', undefined],
      ['product', 'reserve', 'CONFLICT'],
    ]);
  });

  it('in-process, one call is one span with no parent', async () => {
    collect();
    await host.resolve<Facade>('productHandler').list();

    expect(spans).toHaveLength(1);
    expect(spans[0].parentId).toBeUndefined();
  });
});

describe('across a wire — any wire', () => {
  it('over HTTP, both halves share one trace and the receiver hangs off the caller', async () => {
    collect();
    await overHttp.resolve<Facade>('productHandler').list();

    expect(spans).toHaveLength(2);
    const [caller, received] = halves();
    expect(received.traceId).toBe(caller.traceId);
    expect(received.parentId).toBe(caller.spanId);
    // The caller's span contains the receiver's: the difference is what the wire cost.
    expect(caller.ms).toBeGreaterThan(received.ms);
  });

  /**
   * The reason the trace rides the invocation and not a header. This receiver parses no
   * headers because it has none — and the trace crosses anyway, identically to HTTP.
   */
  it('over a bare socket, the same trace crosses just the same', async () => {
    collect();
    await overSocket.resolve<Facade>('productHandler').list();

    expect(spans).toHaveLength(2);
    const [caller, received] = halves();
    expect(received.traceId).toBe(caller.traceId);
    expect(received.parentId).toBe(caller.spanId);
  });

  it('carries the trace even when the call is refused', async () => {
    collect();
    await expect(overHttp.resolve<Facade>('productHandler').reserve()).rejects.toThrow();

    expect(new Set(spans.map((s) => s.traceId)).size).toBe(1);
    expect(spans.every((s) => s.error === 'CONFLICT')).toBe(true);
  });

  it('starts a fresh trace rather than refusing a malformed one', async () => {
    collect();
    await expect(
      overHttp.resolve<Facade>('productHandler').list({ params: {}, query: {}, body: undefined, state: {}, trace: 'not-a-traceparent' }),
    ).resolves.toBeDefined();

    // The bad value is dropped, not inherited: two spans, still one trace, opened here.
    expect(spans).toHaveLength(2);
    const [caller, received] = halves();
    expect(received.traceId).toBe(caller.traceId);
  });
});
