/**
 * What every receiver of the envelope decides the same way, and what it does not.
 *
 * The cap and the answers are POLICY — `1024 * 1024` was spelled in four packages and
 * omitted by the receiver written by hand. Reading the body is PLUMBING, and it belongs to
 * the transport: a `node:http` stream and a `Request` body are read differently, and putting
 * Node through the Web reader HALVED the door that took it (measured, 2026-08-22: the JSON-RPC
 * door fell from 0.677 to 0.341 of its hand-written baseline, while the REST door, which never
 * traverses `serve()`, sat at 0.653 in that same run).
 *
 * So this file holds the decisions. Each receiver keeps its own reader.
 */
import { PARSE_ERROR, type RpcResponse } from './jsonrpc.js';

/** What a receiver accepts before it stops reading. */
export const MAX_BODY_BYTES = 1024 * 1024;

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
