/**
 * The server dual of the couple, in Next — for server components, server actions
 * and route handlers.
 *
 * Same designation as the browser side (class + verb), same return, same errors.
 * `invokeOn` places the call: a local façade executes in memory, a frond listed in
 * `remotes:` goes over JSON-RPC, and the caller never learns which.
 *
 * `next/headers` is the ONLY Next-specific import in this package — measured, and
 * it is what a host actually owns: how to find the current request. It answers
 * inside a request scope and throws outside one, so a call from a script or a test
 * is simply anonymous, the same fallback Nitro's `useEvent()` gets.
 */
import { invokeOn, useFougereApp, sessionViewOf, stateFor, type SessionView } from '@fougere/app';
import type { FrondCall, InvocationContext } from '@fougere/core';

type EntityClass = { name: string };
type CallInput = Partial<InvocationContext>;

export async function invoke<T = unknown>(entity: EntityClass, op: string, input?: CallInput): Promise<T>;
export async function invoke<T = unknown>(call: FrondCall, input?: CallInput): Promise<T>;
export async function invoke<T = unknown>(
  target: EntityClass | FrondCall,
  opOrInput?: string | CallInput,
  input?: CallInput,
): Promise<T> {
  const app = await useFougereApp();
  return invokeOn<T>(app, target, opOrInput, input, await requestState());
}

/** The session a layout may hand to `<FougereSession>` so the page arrives knowing its user. */
export async function getSession(): Promise<SessionView> {
  return sessionViewOf(await requestState());
}

async function requestState(): Promise<Record<string, unknown>> {
  try {
    // Awaited on purpose: async in Next 15+, synchronous before — `await` accepts both.
    const { headers } = await import('next/headers');
    return await stateFor(await headers());
  } catch {
    return {};
  }
}
