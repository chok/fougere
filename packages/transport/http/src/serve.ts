/**
 * Standalone receiver — enough to host a Frond in its own process.
 *
 * Plain node:http, one route: POST /_fougere/call. Mounting the receiving
 * half inside an existing server (@fougere/http, Nitro) is layer-2 work.
 */
import { createServer } from 'node:http';
import type { Transport } from '@fougere/core';
import { PARSE_ERROR, type RpcResponse } from './jsonrpc.js';
import { handleRpc } from './server.js';

export interface ServeOptions {
  /** Port to listen on. 0 (default) picks a free one. */
  port?: number;
  /** Loopback only. A receiver reads identity off the wire, so it has no other bind. */
  host?: string;
  /** Maximum JSON-RPC body size. Default: 1 MiB. */
  maxBodyBytes?: number;
  /** Time allowed to receive a request. Default: 15 seconds. */
  requestTimeoutMs?: number;
}

export interface RunningReceiver {
  port: number;
  close(): Promise<void>;
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export function serve(runner: Transport, options: ServeOptions = {}): Promise<RunningReceiver> {
  const host = options.host ?? '127.0.0.1';
  // A receiver trusts the `state` it is handed — the caller's identity arrives on the
  // wire and nothing here re-establishes it. A shared link secret does not fix that:
  // whoever holds it can claim any user. Until identity is settled at the Frond, the
  // loopback bind IS the guarantee, so a request for any other interface is refused.
  if (!LOOPBACK_HOSTS.has(host)) {
    return Promise.reject(new Error(`A Fougere receiver binds loopback only, got '${host}'`));
  }
  const maxBodyBytes = options.maxBodyBytes ?? 1024 * 1024;
  const server = createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/_fougere/call') {
      res.writeHead(404).end();
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    for await (const value of req) {
      const chunk = Buffer.from(value as Uint8Array);
      size += chunk.length;
      if (size > maxBodyBytes) {
        res.writeHead(413, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'Payload too large' }));
        return;
      }
      chunks.push(chunk);
    }

    let response: RpcResponse;
    try {
      const raw = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      response = await handleRpc(runner, raw);
    } catch {
      response = { jsonrpc: '2.0', id: null, error: { code: PARSE_ERROR, message: 'Parse error' } };
    }
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(response));
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.requestTimeout = options.requestTimeoutMs ?? 15_000;
    server.listen(options.port ?? 0, host, () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      resolve({
        port,
        close: () => new Promise<void>((done, fail) => server.close((err) => (err ? fail(err) : done()))),
      });
    });
  });
}
