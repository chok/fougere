/** What every receiver of the envelope decides the same way, and what it does not. */
import { PARSE_ERROR, type RpcResponse } from './jsonrpc.js';

/** What a receiver accepts before it stops reading — declared by core, re-exported here. */
export { MAX_BODY_BYTES } from '@fougere/core';

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
