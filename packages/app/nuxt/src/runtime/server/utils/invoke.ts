/**
 * The server dual of the couple — same designation (class + verb), same return,
 * same errors. `invokeOn` places the call (local façade → direct in-memory
 * execution, a frond in `remotes` → JSON-RPC on the wire); what this file owns is
 * the one host-specific part: finding the current request.
 *
 * In request context the current session rides along (event.context →
 * invocation.state); outside a request, state is empty or explicit.
 */
import { useEvent } from 'nitropack/runtime';
import { invokeOn, useFougereApp } from '@fougere/app';
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
  return invokeOn<T>(app, target, opOrInput, input, requestState());
}

function requestState(): Record<string, unknown> {
  try {
    return (useEvent()?.context ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}
