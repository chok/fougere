/**
 * Change the protocol, keep the call.
 *
 * The gradient e2e proves a Frond survives moving to another PROCESS, over HTTP.
 * This proves the other half of "transports move the value, never reshape it":
 * the same Frond, the same `remotes:` line, over a protocol that is not HTTP.
 *
 * TCP with one JSON object per line is the honest test, because HTTP hands a
 * transport two things for free that the call contract never asked for: one
 * answer per request, and a fresh connection per call. A socket has neither.
 * So the correlation has to come from somewhere — and it comes from JSON-RPC's
 * `id`, which is already in `frameCall`. The two halves below import their
 * framing from the HTTP client unchanged; what they replace is the ~40 lines
 * that move bytes.
 */
import { scanProject } from '@fougere/core/node';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, connect, type Server, type Socket } from 'node:net';
import { join } from 'node:path';
import { createApp, createLocalRunner, FougereError, ErrorCode } from '@fougere/core';
import type { App, InvocationContext, Transport } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { frameCall, unframeResponse, handleRpc, serve, createHttpTransport } from '../src/index.js';
import type { RpcResponse, RunningReceiver } from '../src/index.js';
// @ts-expect-error plain-JS shared fixture
import { createStorageFactory, PRODUCTS } from './fixtures/data.mjs';

const fixturesDir = join(import.meta.dirname, 'fixtures');
const emptyRoot = '/tmp/fougere-socket-consumer';

type Facade = Record<string, (invocation?: InvocationContext) => Promise<unknown>>;

const inv = (over: Partial<InvocationContext> = {}): InvocationContext =>
  ({ params: {}, query: {}, input: undefined, state: {}, ...over });

/** One JSON value per line — the whole framing a stream protocol needs. */
function lines(onLine: (raw: string) => void): (chunk: Buffer) => void {
  let buffer = '';
  return (chunk) => {
    buffer += chunk.toString('utf8');
    let cut: number;
    while ((cut = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 1);
      if (line.trim()) onLine(line);
    }
  };
}

/** Receiving half over a socket — same `handleRpc`, no HTTP anywhere. */
function serveSocket(runner: Transport): Promise<{ port: number; server: Server }> {
  const server = createServer((socket) => {
    socket.on('data', lines(async (raw) => {
      const response = await handleRpc(runner, JSON.parse(raw));
      socket.write(`${JSON.stringify(response)}\n`);
    }));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ port: typeof address === 'object' && address ? address.port : 0, server });
    });
  });
}

/**
 * Sending half over a socket. One connection carries every call, so answers may
 * come back in any order — `id` pairs them. That bookkeeping is the entire
 * difference from `createHttpTransport`; the framing is the same two functions.
 */
function createSocketTransport(port: number): Transport & { close(): void } {
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();
  let nextId = 1;

  const socket: Socket = connect(port, '127.0.0.1');
  socket.on('data', lines((raw) => {
    const response = JSON.parse(raw) as RpcResponse;
    const waiting = pending.get(response.id as number);
    if (!waiting) return;
    pending.delete(response.id as number);
    // The call is only known here — `unframeResponse` wants it to name the
    // entity on a malformed error, so the pairing carries it back.
    waiting.resolve(response);
  }));

  const transport = (async (call, invocation) => {
    const id = nextId++;
    const response = await new Promise<RpcResponse>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      socket.write(`${JSON.stringify(frameCall(call, invocation, id))}\n`);
    });
    return unframeResponse(response, call);
  }) as Transport & { close(): void };

  transport.close = () => socket.destroy();
  return transport;
}

let app: App;
let localRun: Transport;
let httpReceiver: RunningReceiver;
let httpTransport: Transport;
let socketServer: Server;
let socketTransport: Transport & { close(): void };
let consumer: App;
let facade: Facade;

beforeAll(async () => {
  app = await createApp({ scan: await scanProject(fixturesDir), createContainer, storageFactory: createStorageFactory() });
  localRun = createLocalRunner(app);

  httpReceiver = await serve(localRun, { port: 0 });
  httpTransport = createHttpTransport(`http://127.0.0.1:${httpReceiver.port}`);

  const socket = await serveSocket(localRun);
  socketServer = socket.server;
  socketTransport = createSocketTransport(socket.port);

  // The `remotes:` line is the only topology statement — and it says nothing
  // about HTTP. The address is a label the transport factory interprets.
  consumer = await createApp({
    scan: await scanProject(emptyRoot),
    createContainer,
    remotes: { catalog: `tcp://127.0.0.1:${socket.port}` },
    remoteTransport: () => socketTransport,
  });
  facade = consumer.resolve<Facade>('productHandler');
}, 30_000);

afterAll(async () => {
  socketTransport?.close();
  socketServer?.close();
  await httpReceiver?.close();
  await consumer?.dispose();
  await app?.dispose();
});

async function outcomeOf(run: () => Promise<unknown>): Promise<unknown> {
  try {
    return { ok: await run() };
  } catch (err) {
    if (err instanceof FougereError) {
      const { code, message, entity, operation, details } = err;
      return { failed: { code, message, entity, operation, details } };
    }
    throw err;
  }
}

describe('the protocol changes, the call does not', () => {
  const cases: [string, string, InvocationContext][] = [
    ['list', 'list', inv()],
    ['findById (hit)', 'findById', inv({ params: { id: 'p1' } })],
    ['findById (miss)', 'findById', inv({ params: { id: 'ghost' } })],
    ['create (valid)', 'create', inv({ input: { title: 'Ivy', stock: 5 } })],
    ['create (invalid — judged where the handler lives)', 'create', inv({ input: { stock: -2 } })],
    ['reserve (business failure)', 'reserve', inv()],
    ['unknown op', 'teleport', inv()],
  ];

  it.each(cases)('in-process, HTTP and TCP agree on %s', async (_label, op, invocation) => {
    const call = { entity: 'product', op };
    const local = await outcomeOf(() => localRun(call, invocation));
    const http = await outcomeOf(() => httpTransport(call, invocation));
    const tcp = await outcomeOf(() => socketTransport(call, invocation));

    const wire = JSON.parse(JSON.stringify(local));
    expect(http).toEqual(wire);
    expect(tcp).toEqual(wire);
  }, 15_000);

  it('the identity card crosses a socket, so `remotes:` routes without HTTP', async () => {
    expect(await facade.list()).toEqual(PRODUCTS);
  });

  it('a business failure keeps its details over TCP', async () => {
    await expect(facade.reserve()).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
      message: 'stock déjà réservé',
      details: { reason: 'held' },
    });
  });
});

describe('asynchrony — what the socket makes visible and HTTP hid', () => {
  it('several calls are in flight on one connection, and `id` pairs the answers', async () => {
    // Nothing is awaited between the writes: three frames leave back to back on
    // the same socket. HTTP would have opened three connections and let the
    // kernel do the pairing; here the contract does it.
    const inFlight = [
      socketTransport({ entity: 'product', op: 'findById' }, inv({ params: { id: 'p2' } })),
      outcomeOf(() => socketTransport({ entity: 'product', op: 'reserve' }, inv())),
      socketTransport({ entity: 'product', op: 'findById' }, inv({ params: { id: 'p1' } })),
      socketTransport({ entity: 'rpc', op: 'discover' }, inv()),
    ];
    const [second, failure, first, card] = await Promise.all(inFlight);

    expect(second).toEqual(PRODUCTS[1]);
    expect(first).toEqual(PRODUCTS[0]);
    expect(failure).toMatchObject({ failed: { code: ErrorCode.CONFLICT } });
    expect((card as { fronds: { name: string }[] }).fronds.map((f) => f.name)).toEqual(['catalog']);
  }, 15_000);

  it('a fire-and-forget command is REFUSED: the receiver has no notification', async () => {
    // JSON-RPC 2.0 has the form — a request with no `id` is a notification, and
    // the spec says answer nothing. It is exactly "push is a command whose
    // result nobody waits for". `handleRpc` (server.ts:14) treats a missing id
    // as a malformed request instead, so the async regime has no wire form yet.
    const answered = await new Promise<RpcResponse>((resolve) => {
      const probe = connect(socketServer.address() ? (socketServer.address() as { port: number }).port : 0, '127.0.0.1', () => {
        probe.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'product.create', params: inv({ input: { title: 'Ivy', stock: 1 } }) })}\n`);
      });
      probe.on('data', lines((raw) => {
        probe.destroy();
        resolve(JSON.parse(raw) as RpcResponse);
      }));
    });

    expect(answered).toMatchObject({
      id: null,
      error: { message: 'Invalid JSON-RPC 2.0 request' },
    });
  }, 15_000);
});
