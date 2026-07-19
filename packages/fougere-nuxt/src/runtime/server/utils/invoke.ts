/**
 * The server dual of the couple — same designation (class + verb), same
 * return, same errors. Fabricates the call value and hands it to the app
 * runner: local façade → direct in-memory execution, frond in `remotes`
 * → JSON-RPC on the wire. The caller never knows which.
 *
 * In request context the current session rides along (event.context →
 * invocation.state); outside a request, state is empty or explicit.
 */
import { useEvent } from 'nitropack/runtime';
import {
  createAppRunner,
  callValueOf,
  type FrondCall,
  type InvocationContext,
} from '@fougere/core';
import { useFougereApp } from './fougereApp';

type EntityClass = { name: string };
type CallInput = Partial<InvocationContext>;

export async function invoke<T = unknown>(entity: EntityClass, op: string, input?: CallInput): Promise<T>;
export async function invoke<T = unknown>(call: FrondCall, input?: CallInput): Promise<T>;
export async function invoke<T = unknown>(
  target: EntityClass | FrondCall,
  opOrInput?: string | CallInput,
  input?: CallInput,
): Promise<T> {
  const given = typeof opOrInput === 'string' ? input : opOrInput;
  const { call, invocation } = callValueOf(target, opOrInput, input);
  const state = given?.state ?? requestState();
  const app = await useFougereApp();
  return (await createAppRunner(app)(call, { ...invocation, state })) as T;
}

function requestState(): Record<string, unknown> {
  try {
    return (useEvent()?.context ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}
