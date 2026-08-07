/**
 * A transport you wrote yourself — TCP, one JSON object per line.
 *
 * This file is the demo's whole point: it is not a package you install, it is
 * ~60 lines of application code. Fougere's side of the contract is two
 * functions, imported here unchanged from the HTTP transport because neither
 * of them has anything to do with HTTP:
 *
 *   frameCall / unframeResponse   the JSON-RPC 2.0 written form of a call
 *   handleRpc                     the receiving half — object in, object out
 *
 * What is left for a protocol to supply is moving bytes, and saying what it
 * means when they do not arrive. That second half is most of the code below,
 * and it is the honest cost: HTTP hands you one answer per request and a fresh
 * connection per call. A socket hands you neither, so `id` pairs the answers
 * and the failure vocabulary is yours to write.
 */
import { createServer, connect, type Server, type Socket } from 'node:net';
import { FougereError, ErrorCode, type Transport } from '@fougere/core';
import { frameCall, unframeResponse, handleRpc, type RpcResponse } from '@fougere/transport-http';

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

/** Receiving half. No `serve()`, no route, no port to guard — just a loop. */
export function serveSocket(runner: Transport, port = 0): Promise<{ port: number; server: Server }> {
  const server = createServer((socket) => {
    socket.on('data', lines(async (raw) => {
      const response = await handleRpc(runner, JSON.parse(raw));
      socket.write(`${JSON.stringify(response)}\n`);
    }));
    socket.on('error', () => socket.destroy());
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      resolve({ port: typeof address === 'object' && address ? address.port : 0, server });
    });
  });
}

export interface SocketTransportOptions {
  /** Abort a call after this long. A timed-out call may have executed. */
  timeoutMs?: number;
}

/**
 * Sending half. One connection carries every call, so answers may come back in
 * any order — `id` pairs them, which is exactly what JSON-RPC put it there for.
 */
export function createSocketTransport(
  port: number,
  options: SocketTransportOptions = {},
): Transport & { close(): void } {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const pending = new Map<number, (outcome: { response?: RpcResponse; error?: FougereError }) => void>();
  let nextId = 1;

  const socket: Socket = connect(port, '127.0.0.1');
  socket.on('data', lines((raw) => {
    const response = JSON.parse(raw) as RpcResponse;
    pending.get(response.id as number)?.({ response });
  }));

  // The half a happy path forgets: a dead socket must fail every call in
  // flight, or they hang forever. HTTP never needed this — it opened a new
  // connection each time, so there was nothing in flight to strand.
  const strand = (reason: string) => {
    for (const [id, settle] of pending) {
      pending.delete(id);
      settle({ error: new FougereError({ code: ErrorCode.SERVICE_UNAVAILABLE, message: reason, entity: 'socket' }) });
    }
  };
  socket.on('error', (err) => strand(`socket failed: ${err.message}`));
  socket.on('close', () => strand('socket closed'));

  const transport = (async (call, invocation) => {
    const id = nextId++;
    const outcome = await new Promise<{ response?: RpcResponse; error?: FougereError }>((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve({ error: new FougereError({
          code: ErrorCode.GATEWAY_TIMEOUT,
          message: `${call.entity}.${call.op} timed out after ${timeoutMs}ms`,
          entity: call.entity,
          operation: call.op,
        }) });
      }, timeoutMs);
      pending.set(id, (settled) => { clearTimeout(timer); pending.delete(id); resolve(settled); });
      socket.write(`${JSON.stringify(frameCall(call, invocation, id))}\n`);
    });

    if (outcome.error) throw outcome.error;
    return unframeResponse(outcome.response!, call);
  }) as Transport & { close(): void };

  transport.close = () => socket.destroy();
  return transport;
}
