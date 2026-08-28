/**
 * Contract surface — what a sender needs to speak to a receiver, and
 * nothing that assumes a runtime: the error vocabulary, the invocation
 * shape, the call value, the naming convention.
 *
 * Browser-safe by design: no node builtin may enter this module's import
 * graph. Published as the `@fougere/core/contract` subpath so client
 * bundles never touch the full index (scanner, config loader). `@fougere/schema`
 * is allowed in — measured, it imports no node builtin either.
 */
import { lowerFirst } from '@fougere/schema';
import { canonicalInvocation, type InvocationContext } from './wire/invocation.js';
import type { FrondCall } from './wire/call.js';

export { FougereError, ErrorCode, validationErrorsOf } from './wire/errors.js';
// A receiver turns a refusal into what may cross a process boundary, and it is not
// core's boot — reaching it through the main entry dragged the scanner into a bundle.
export { toPublicError } from './wire/http-error.js';
export type { FougereErrorOptions } from './wire/errors.js';
export { canonicalInvocation, EMPTY_INVOCATION } from './wire/invocation.js';
export type { InvocationContext } from './wire/invocation.js';
export { Invocation } from './contract/Invocation.js';
export type { InvocationInput } from './contract/Invocation.js';
export { Call } from './contract/Call.js';
export { RouteAddress } from './contract/RouteAddress.js';
export type { RouteAddressInput } from './contract/RouteAddress.js';
export type { FrondCall, Transport, SignedCall } from './wire/call.js';
// The reserved entity, VALUE and not type: a consumer that wants to leave it alone — a
// call log ignoring its own reader — has to be able to name it.
export { RPC_ENTITY } from './wire/call.js';
export type { CallPage, CallRecord } from './contract/CallLog.js';
// The comparison of two cards, which a consumer runs about a producer — browser-safe on
// purpose: a panel showing the drift holds only the two cards, never the app.
export { driftOf, agrees, explain } from './wire/drift.js';
export type { CardDrift } from './wire/drift.js';

/**
 * What `rpc.discover` answers. It belongs here and not to the runtime: the
 * reserved op travels on the same wire as every other call, so a consumer that
 * only sends — a browser bundle, a frond written elsewhere — needs its shape and
 * nothing else. Type-only, so `call.js` never enters the runtime graph.
 *
 * Stated once, on purpose: two private copies of this interface have already gone
 * stale (the CLI's, then the Rust demo's) the day an op stopped being a bare name.
 */
export type { IdentityCard, CardOp, TopologyReport, FrondPlacement, Edge } from './wire/call.js';
export { assertIdentityCard } from './wire/call.js';

/**
 * The key a class name is filed under — 'Post' → 'post'. Re-exported rather than
 * respelled: a card writes it and a foreign key derives from it, so the convention
 * belongs to the schema, and a second copy here is a second opinion. It travels
 * through this subpath because a consumer of the wire (a browser bundle) may hold no
 * schema dependency of its own — that audience only. Inside the package it is read from
 * `@fougere/schema` directly: routing four modules through here bought nothing and put
 * this file inside a cycle.
 */
export { lowerFirst } from '@fougere/schema';

/** A call, fully fabricated: the designation and its completed invocation. */
export interface CallValue {
  call: FrondCall;
  invocation: InvocationContext;
}

/**
 * Fabricate the call value — one designation, two spellings:
 * `callValueOf(Post, 'list', { query })` (class + verb) or
 * `callValueOf({ entity, op }, input)` (raw, for dynamic bridges).
 * Missing invocation fields complete to the empty invocation.
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
