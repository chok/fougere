/** The server dual of the couple — same designation (class + verb), same return, same errors. */
import { useEvent } from 'nitropack/runtime';
import { invokeOn, useFougereApp } from '@fougere/app';
import type { FrondCall, InvocationContext } from '@fougere/core';
import { stateOf } from '../stateOf.js';

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

/**
 * The state every other door hands a call — the session, without its token — never the whole of
 * Nitro's context, which a call that crosses would carry. Outside a request there is none.
 */
function requestState(): Record<string, unknown> {
  try {
    const event = useEvent();

    return event ? stateOf(event) : {};
  } catch {
    return {};
  }
}
