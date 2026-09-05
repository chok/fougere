/**
 * Contract surface — what a sender needs to speak to a receiver, and nothing that assumes a
 * runtime: the error vocabulary, the invocation shape, the call value, the naming convention.
 */
import { lowerFirst } from '@fougere/schema';
import { canonicalInvocation, type InvocationContext } from './wire/Invocation.js';
import type { FrondCall } from './wire/call.js';

export { FougereError, ErrorCode, validationErrorsOf } from './wire/errors.js';
// A receiver turns a refusal into what may cross a process boundary, and it is not
// core's boot — reaching it through the main entry dragged the scanner into a bundle.
export { toPublicError } from './wire/http-error.js';
export type { FougereErrorOptions } from './wire/errors.js';
export { canonicalInvocation, EMPTY_INVOCATION } from './wire/Invocation.js';
export type { InvocationContext } from './wire/Invocation.js';
export { Invocation } from './wire/Invocation.js';
export type { PartialInvocation } from './wire/Invocation.js';
export { Call } from './wire/call.js';
export { RouteAddress } from './wire/RouteAddress.js';
export type { RouteAddressInput } from './wire/RouteAddress.js';
export type { FrondCall, Transport, SignedCall } from './wire/call.js';
export { MAX_BODY_BYTES } from './wire/call.js';
// The reserved entity, VALUE and not type: a consumer that wants to leave it alone — a
// call log ignoring its own reader — has to be able to name it.
export { RPC_ENTITY } from './wire/call.js';
export type { CallPage, CallRecord } from './wire/CallLog.js';
// The comparison of two cards, which a consumer runs about a producer — browser-safe on
// purpose: a panel showing the drift holds only the two cards, never the app.
export { driftOf, agrees, explain } from './wire/drift.js';
export type { CardDrift } from './wire/drift.js';

/** What `rpc.discover` answers. */
export type { IdentityCard, CardOp, TopologyReport, FrondPlacement, Edge } from './wire/call.js';
export { assertIdentityCard } from './wire/call.js';

/** The key a class name is filed under — 'Post' → 'post'. */
export { lowerFirst } from '@fougere/schema';

/** A call, fully fabricated: the designation and its completed invocation. */
export interface CallValue {
  call: FrondCall;
  invocation: InvocationContext;
}

/**
 * Fabricate the call value — one designation, two spellings: `callValueOf(Post, 'list', { query
 * })` (class + verb) or `callValueOf({ entity, op }, input)` (raw, for dynamic bridges).
 */
export function callValueOf(
  target: { name: string } | FrondCall,
  opOrInput?: string | Partial<InvocationContext>,
  input?: Partial<InvocationContext>,
): CallValue {
  const [call, given] =
    typeof opOrInput === 'string'
      ? [{ entity: lowerFirst((target as { name: string }).name), op: opOrInput }, input]
      : [target as FrondCall, opOrInput];
  return { call, invocation: canonicalInvocation(given) };
}
