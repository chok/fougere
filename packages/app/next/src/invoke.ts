/** The server dual of the couple, in Next — for server components, server actions and route handlers. */
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
