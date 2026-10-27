/**
 * The envelope facade for a host that speaks `Request`/`Response` — hono, a Worker, Next, SvelteKit.
 *
 * It reads a `Request` body and `serve` reads a `node:http` stream; the two stay separate
 * because putting Node through this reader HALVED the Node facade — 0.677 to 0.341 of its
 * baseline, measured 2026-08-22.
 */
import { handleRpc, type ReceiveOptions } from './server.js';
import { maxFrameBytes, CALL_PATH, parseError, tooLarge } from './policy.js';
import { ErrorCode, FougereError, readWithin, type Transport } from '@fougere/core/contract';

export interface ReceiveHttpOptions extends ReceiveOptions {
  /** The path this facade answers. Default: `/_fougere/call`. */
  path?: string;
  /** Take unsigned calls, deliberately. */
  allowUnsigned?: boolean;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export function receive(
  runner: Transport,
  options: ReceiveHttpOptions = {},
): (request: Request) => Promise<Response> {
  // At CONSTRUCTION and not per call, for the reason `serve` refuses at bind: a receiver
  // that starts and then rejects everything is found in production.
  if (!options.verify && !options.allowUnsigned) {
    throw new Error(
      'This receiver would trust any caller. Pass `verify` (see `verifyEnvelope`, `fougere keys`, `fougere grant`),\n'
      + '  or `allowUnsigned: true` for local development or behind a proxy that already checks callers.',
    );
  }

  const path = options.path ?? CALL_PATH;

  return async (request) => {
    if (request.method !== 'POST' || new URL(request.url).pathname !== path) {
      return new Response(null, { status: 404 });
    }

    let raw: string;
    try {
      raw = await readWithin(request.body, maxFrameBytes(), request.headers.get('content-length'));
    } catch (refused) {
      if (!(refused instanceof FougereError && refused.code === ErrorCode.PAYLOAD_TOO_LARGE)) throw refused;

      return json(tooLarge(), 413);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json(parseError());
    }

    return json(await handleRpc(runner, parsed, options));
  };
}

export { pageDoor, type PageDoorOptions } from './server.js';
export { PARSE_ERROR } from './jsonrpc/RpcErrorShape.js';
