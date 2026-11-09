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

export { pageDoor } from './server.js';
export type { PageDoorOptions } from './PageDoorOptions.js';
export { PARSE_ERROR } from './jsonrpc/RpcErrorShape.js';
