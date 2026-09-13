/**
 * Contract surface — what a sender needs to speak to a receiver, and nothing that assumes a
 * runtime: the error vocabulary, the invocation shape, the call value, the naming convention.
 */
import { lowerFirst } from '@fougere/schema';
import { Invocation } from './wire/Invocation.js';
import { type InvocationContext } from './wire/InvocationContext.js';
import type { FrondCall } from './wire/FrondCall.js';

export { ErrorCode } from './wire/ErrorCode.js';
export { FougereError, validationErrorsOf } from './wire/FougereError.js';
// What a read may ask about one field. Here rather than on the main entry because an
// adapter reads it to compile a query, and an adapter carries no boot.
export { comparisonOf, comparisonsIn } from './storage/Comparison.js';
export type { Comparison } from './storage/Comparison.js';
// A receiver turns a refusal into what may cross a process boundary, and it is not
// core's boot — reaching it through the main entry dragged the scanner into a bundle.
export { toPublicError } from './wire/http-error.js';
export { Invocation } from './wire/Invocation.js';
export type { InvocationContext } from './wire/InvocationContext.js';
export { Call } from './wire/Call.js';
export { RouteAddress } from './wire/RouteAddress.js';
export type { FrondCall } from './wire/FrondCall.js';
export type { SignedCall } from './wire/SignedCall.js';
export type { Transport } from './wire/Transport.js';
export { MAX_BODY_BYTES } from './wire/SignedCall.js';
// The reserved entity, VALUE and not type: a consumer that wants to leave it alone — a
// call log ignoring its own reader — has to be able to name it.
export { RPC_ENTITY } from './wire/RpcAnswer.js';
export type { CallPage } from './wire/CallPage.js';
export type { CallRecord } from './wire/CallRecord.js';
// The comparison of two cards, which a consumer runs about a producer — browser-safe on
// purpose: a panel showing the drift holds only the two cards, never the app.
export { driftOf, agrees, explain } from './wire/drift.js';
export type { CardDrift } from './wire/drift.js';

/** What `rpc.discover` answers. */
export { refusalsOf, type Refusable } from './wire/refusals.js';
export type { FougereOperations, FacadeName, Addresses, AnyHandler, HandlerOf, Refused, FougereHandlers, Answer, Rows } from './wire/facade.js';
export type { CardOp } from './wire/card/CardOp.js';
export type { IdentityCard } from './wire/card/IdentityCard.js';
export type { DeclaredEdge } from './wire/topology/DeclaredEdge.js';
export type { DeclaredFrond } from './wire/topology/DeclaredFrond.js';
export type { DeclaredTopology } from './wire/topology/DeclaredTopology.js';
export type { Edge } from './wire/topology/Edge.js';
export type { FrondPlacement } from './wire/topology/FrondPlacement.js';
export type { TopologyReport } from './wire/topology/TopologyReport.js';
export { assertIdentityCard } from './wire/card/IdentityCard.js';

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
  return { call, invocation: Invocation.from(given) };
}
