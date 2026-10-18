import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Transport } from '@fougere/core';
import type { RpcResponse } from '../jsonrpc/RpcResponse.js';
import { handleRpc } from '../server.js';
import { maxFrameBytes, CALL_PATH, parseError, tooLarge } from '../policy.js';
import type { ServeOptions } from './ServeOptions.js';

export interface RunningReceiver {
  port: number;
  close(): Promise<void>;
}

/** What a frond binds when nobody says otherwise. */
export const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '::1'];

export function serve(runner: Transport, options: ServeOptions = {}): Promise<RunningReceiver> {
  const host = options.host ?? (options.hosts ?? LOOPBACK_HOSTS)[0];
  const refusal = whyNotHere(host, options);
  if (refusal) return Promise.reject(refusal);

  return listening(createServer(answering(runner, options)), host!, options);
}

/**
 * Where a receiver binds and what it admits are two questions. `verify` answers the second —
 * without it this receiver takes the `state` it is handed, and `hosts` is all that stands.
 * Loopback or signed: there is no third way to serve.
 */
function whyNotHere(host: string | undefined, options: ServeOptions): Error | undefined {
  const allowed = options.hosts ?? LOOPBACK_HOSTS;
  if (allowed.length === 0) {
    return new Error('`hosts` is empty: give the receiver at least one host to listen on.');
  }

  if (host === undefined || !allowed.includes(host)) {
    return new Error(
      `The receiver cannot listen on '${host}', which is not in \`hosts\` (${allowed.join(', ')}). Add it there.`,
    );
  }

  if (LOOPBACK_HOSTS.includes(host) || options.verify || options.allowUnsigned) return undefined;

  return new Error(
    `A receiver on '${host}' can be reached from other machines and would trust any caller.\n`
    + '  - `fougere keys` once, then inject FOUGERE_ROOT_KEY here (and `fougere grant <frond>` for each caller), or\n'
    + '  - keep it on loopback, or\n'
    + '  - pass `allowUnsigned: true` if a mesh or an ingress already authenticated the caller.',
  );
}

/** One path, one method, and a body that is refused before it is read whole. */
function answering(runner: Transport, options: ServeOptions) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'POST' || req.url !== CALL_PATH) {
      res.writeHead(404).end();

      return;
    }

    const maxBodyBytes = maxFrameBytes();
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const value of req) {
      const chunk = Buffer.from(value as Uint8Array);
      size += chunk.length;
      if (size > maxBodyBytes) {
        res.writeHead(413, { 'content-type': 'application/json' }).end(JSON.stringify(tooLarge()));

        return;
      }
      chunks.push(chunk);
    }

    let response: RpcResponse;
    try {
      response = await handleRpc(runner, JSON.parse(Buffer.concat(chunks).toString('utf8')), options);
    } catch {
      response = parseError();
    }

    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(response));
  };
}

/** The port a receiver ended up on — asked of the server, since 0 means "whatever is free". */
function listening(server: Server, host: string, options: ServeOptions): Promise<RunningReceiver> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.requestTimeout = options.requestTimeoutMs ?? 15_000;
    server.listen(options.port ?? 0, host, () => {
      const address = server.address();

      resolve({
        port: typeof address === 'object' && address !== null ? address.port : 0,
        close: () => new Promise<void>((done, fail) => server.close((err) => (err ? fail(err) : done()))),
      });
    });
  });
}
