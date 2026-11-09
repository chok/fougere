import { lowerFirst } from '@fougere/schema';
import { Invocation } from './wire/Invocation.js';
import { type InvocationContext } from './wire/InvocationContext.js';
import type { FrondCall } from './wire/FrondCall.js';

export { ErrorCode } from './wire/ErrorCode.js';
export { FougereError, validationErrorsOf } from './wire/FougereError.js';
export { comparisonOf, comparisonsIn } from './storage/Comparison.js';
export type { Comparison } from './storage/Comparison.js';
export { isChange } from './storage/Change.js';
export { Turns } from './storage/Turns.js';
export type { Change } from './storage/Change.js';
export { toPublicError } from './wire/http-error.js';
export { Invocation } from './wire/Invocation.js';
export type { InvocationContext } from './wire/InvocationContext.js';
export type { PartialInvocation } from './wire/PartialInvocation.js';
export { Call } from './wire/Call.js';
export { RouteAddress } from './wire/RouteAddress.js';
export type { FrondCall } from './wire/FrondCall.js';
export type { SignedCall } from './wire/SignedCall.js';
export type { Transport } from './wire/Transport.js';
export { ENVELOPE_BYTES, maxBodyBytes, maxFrameBytes, readWithin, setMaxBodyBytes } from './wire/BodyLimit.js';
export { RPC_ADDRESS } from './wire/RpcAnswer.js';
export type { CallPage } from './wire/CallPage.js';
export { Page, asPage } from './wire/Page.js';
export type { CallRecord } from './wire/CallRecord.js';
export { driftOf, agrees, explain } from './wire/drift.js';
export type { CardDrift } from './wire/drift.js';

/** What `rpc.discover` answers. */
export { refusalsOf, type Refusable } from './wire/refusals.js';
export type { Addresses } from './wire/Addresses.js';
export type { Answer } from './wire/Answer.js';
export type { AnyHandler } from './wire/AnyHandler.js';
export type { FacadeName } from './wire/FacadeName.js';
export type { FougereHandlers } from './wire/FougereHandlers.js';
export type { FougereOperations } from './wire/FougereOperations.js';
export type { HandlerOf } from './wire/HandlerOf.js';
export type { Refused } from './wire/Refused.js';
export type { Rows } from './wire/Rows.js';
export type { CardOp } from './wire/card/CardOp.js';
export type { IdentityCard } from './wire/card/IdentityCard.js';
export type { DeclaredEdge } from './wire/topology/DeclaredEdge.js';
export type { DeclaredFrond } from './wire/topology/DeclaredFrond.js';
export type { DeclaredTopology } from './wire/topology/DeclaredTopology.js';
export type { Edge } from './wire/topology/Edge.js';
export { OPERATION_KINDS, type OperationKind } from './wire/OperationKind.js';
export { CARDINALITIES, type Cardinality } from './wire/Cardinality.js';
export { PLACEMENTS, type Placement } from './wire/Placement.js';
export type { FrondPlacement } from './wire/topology/FrondPlacement.js';
export type { TopologyReport } from './wire/topology/TopologyReport.js';
export { assertIdentityCard } from './wire/card/IdentityCard.js';
export { decoded } from './dispatch/decoded.js';

/** The key a class name is filed under — 'Post' → 'post'. */
export { lowerFirst } from '@fougere/schema';

/** A call, fully fabricated: the designation and its completed invocation. */
export interface CallValue {
  call: FrondCall;
  invocation: InvocationContext;
}

/**
 * The call value, from a class and a verb or from a raw address.
 * Ex: `callValueOf(Post, 'list', { query })`.
 */
export function callValueOf(
  target: { name: string } | FrondCall,
  opOrInput?: string | Partial<InvocationContext>,
  input?: Partial<InvocationContext>,
): CallValue {
  const [call, given] =
    typeof opOrInput === 'string'
      ? [{ address: lowerFirst((target as { name: string }).name), op: opOrInput }, input]
      : [target as FrondCall, opOrInput];

  return { call, invocation: Invocation.from(given) };
}
export { answerAt, type Answering, type Door, type DoorCycle, type DoorOutcome } from './entry/door.js';
