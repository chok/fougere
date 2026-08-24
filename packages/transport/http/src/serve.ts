/**
 * Standalone receiver — enough to host a Frond in its own process.
 *
 * Plain node:http, one route: POST /_fougere/call. Mounting the receiving
 * half inside an existing server (@fougere/http, Nitro) is layer-2 work.
 */
import { createServer } from 'node:http';
import type { Transport } from '@fougere/core';
import type { RpcResponse } from './jsonrpc.js';
import { handleRpc, type ReceiveOptions } from './server.js';
import { MAX_BODY_BYTES, CALL_PATH, parseError, tooLarge } from './policy.js';

export interface ServeOptions extends ReceiveOptions {
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
  /**
   * Serve unsigned calls beyond loopback, deliberately.
   *
   * The one case that legitimately needs it: something in front already established the
   * peer — a service mesh whose sidecar terminated mTLS, an ingress doing client certs.
   * Asking for a second signature there would redo what was just done a centimetre away.
   *
   * It is spelled separately from `requireIdentity` on purpose: that one arrives `false`
   * by default from `identityFromEnv`, so it cannot also mean "I thought about this".
   */
  allowUnsigned?: boolean;
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
  // Where a receiver binds, and what it admits, are two questions now. `verify` answers
  // the second — without it this receiver still takes the `state` it is handed, and
  // `hosts` is all that stands. The default keeps it on the machine; widening it is
  // written down rather than inferred, and a widened receiver wants `requireIdentity`.
  if (!allowed.includes(host)) {
    return Promise.reject(
      new Error(`A Fougere receiver binds one of [${allowed.join(', ')}], got '${host}' — add it to \`hosts\` to allow it`),
    );
  }
  /**
   * Loopback or signed — there is no third way to serve.
   *
   * The address already carries the decision: binding beyond loopback is a deliberate
   * act (`hosts` says so), and a receiver reachable from outside that establishes nothing
   * takes the `state` it is handed. Refusing at BOOT and not per call is the point — a
   * receiver that starts and then rejects everything is discovered in production, one
   * that will not start is discovered at deployment.
   */
  if (!LOOPBACK_HOSTS.includes(host) && !options.verify && !options.allowUnsigned) {
    return Promise.reject(
      new Error(
        `A Fougere receiver on '${host}' is reachable from outside this machine and would believe whatever `
        + 'state it is handed.\n'
        + '  - `fougere keys` once, then inject FOUGERE_ROOT_KEY here (and `fougere grant <frond>` for each caller), or\n'
        + '  - keep it on loopback, or\n'
        + '  - pass `allowUnsigned: true` if a mesh or an ingress already authenticated the caller.',
      ),
    );
  }

  const maxBodyBytes = options.maxBodyBytes ?? MAX_BODY_BYTES;
  const server = createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== CALL_PATH) {
      res.writeHead(404).end();
      return;
    }

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
      const raw = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      response = await handleRpc(runner, raw, options);
    } catch {
      response = parseError();
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
