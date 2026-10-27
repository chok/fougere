import { serve as listen } from 'srvx';
import { ErrorCode, FougereError, readWithin, type Transport } from '@fougere/core';
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

  return listening(runner, host!, options);
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
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST' || new URL(request.url).pathname !== CALL_PATH) {
      return (await options.beside?.(request)) ?? new Response(null, { status: 404 });
    }

    let raw: string;
    try {
      raw = await readWithin(request.body, maxFrameBytes(), request.headers.get('content-length'));
    } catch (refused) {
      if (!(refused instanceof FougereError && refused.code === ErrorCode.PAYLOAD_TOO_LARGE)) throw refused;

      return Response.json(tooLarge(), { status: 413 });
    }

    let response: RpcResponse;
    try {
      response = await handleRpc(runner, JSON.parse(raw), options);
    } catch {
      response = parseError();
    }

    return Response.json(response);
  };
}

/** The port a receiver ended up on — read off where it listens, since 0 means "whatever is free". */
async function listening(runner: Transport, host: string, options: ServeOptions): Promise<RunningReceiver> {
  const server = listen({
    fetch: answering(runner, options),
    port: options.port ?? 0,
    hostname: host,
    silent: true,
    node: { requestTimeout: options.requestTimeoutMs ?? 15_000 },
  });
  await server.ready();

  return {
    port: Number(new URL(server.url!).port),
    close: () => server.close(),
  };
}
