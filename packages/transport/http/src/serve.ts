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
  host?: string;
}

export interface RunningReceiver {
  port: number;
  close(): Promise<void>;
}

export function serve(runner: Transport, options: ServeOptions = {}): Promise<RunningReceiver> {
  const server = createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/_fougere/call') {
      res.writeHead(404).end();
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);

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
    server.listen(options.port ?? 0, options.host ?? '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      resolve({
        port,
        close: () => new Promise<void>((done, fail) => server.close((err) => (err ? fail(err) : done()))),
      });
    });
  });
}
