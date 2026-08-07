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
  /**
   * The addresses this receiver may bind. Default: loopback only.
   *
   * A receiver reads the caller's identity off the wire and re-establishes
   * nothing, so reaching beyond the machine is a decision its operator takes
   * — stating it here IS taking it. The default is what a frond on a laptop
   * wants; a container wants `hosts: ['0.0.0.0']` and says so.
   */
  hosts?: string[];
  /** Which address to bind. Must be one of `hosts`. Defaults to its first. */
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

/** What a frond binds when nobody says otherwise. */
export const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '::1'];

export function serve(runner: Transport, options: ServeOptions = {}): Promise<RunningReceiver> {
  const allowed = options.hosts ?? LOOPBACK_HOSTS;
  if (allowed.length === 0) {
    return Promise.reject(new Error('A Fougere receiver needs at least one host to bind, `hosts` is empty'));
  }
  const host = options.host ?? allowed[0];
  // A receiver trusts the `state` it is handed — the caller's identity arrives on
  // the wire and nothing here re-establishes it. `hosts` is where that fact meets a
  // deployment: the default keeps it on the machine, and widening it is written down
  // rather than inferred. A shared link secret would not help — whoever holds it can
  // claim any user — so the answer stays identity at the Frond.
  if (!allowed.includes(host)) {
    return Promise.reject(
      new Error(`A Fougere receiver binds one of [${allowed.join(', ')}], got '${host}' — add it to \`hosts\` to allow it`),
    );
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
