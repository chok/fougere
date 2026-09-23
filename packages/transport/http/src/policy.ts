/** What every receiver of the envelope decides the same way, and what it does not. */
import { PARSE_ERROR } from './jsonrpc/RpcErrorShape.js';
import { type RpcResponse } from './jsonrpc/RpcResponse.js';

/** What a receiver reads before it stops — the caller's limit and the envelope's room, both core's. */
export { maxFrameBytes } from '@fougere/core';

/** The path the envelope answers on. A host mounting it elsewhere passes its own. */
export const CALL_PATH = '/_fougere/call';

/** The answer to a payload that was not JSON. */
export const parseError = (): RpcResponse => ({
  jsonrpc: '2.0',
  id: null,
  error: { code: PARSE_ERROR, message: 'Parse error' },
});

/** The answer to a body over the cap. */
export const tooLarge = () => ({ error: 'Payload too large' });
