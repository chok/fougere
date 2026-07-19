/**
 * Contract surface — what a sender needs to speak to a receiver, and
 * nothing that assumes a runtime: the error vocabulary, the invocation
 * shape, the call value, the naming convention.
 *
 * Browser-safe by design: no node builtin may enter this module's import
 * graph. Published as the `@fougere/core/contract` subpath so client
 * bundles never touch the full index (scanner, config loader).
 */
import { EMPTY_INVOCATION, type InvocationContext } from './invocation.js';
import type { FrondCall } from './call.js';

export { FougereError, ErrorCode } from './middleware.js';
export type { FougereErrorOptions } from './middleware.js';
export { EMPTY_INVOCATION } from './invocation.js';
export type { InvocationContext } from './invocation.js';
export type { FrondCall, Transport } from './call.js';

/** Registration key of a class — 'Post' → 'post', 'PostHandler' → 'postHandler'. */
export function toRegistrationName(name: string): string {
  return name[0].toLowerCase() + name.slice(1);
}

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
      ? [{ entity: toRegistrationName((target as { name: string }).name), op: opOrInput }, input]
      : [target as FrondCall, opOrInput];
  return { call, invocation: { ...EMPTY_INVOCATION, ...given } };
}
