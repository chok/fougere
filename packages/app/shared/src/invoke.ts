import { createAppRunner, callValueOf, type App, type FrondCall, type InvocationContext } from '@fougere/core';
import { nobodyWhenUnserved, SESSION_CALL, type SessionView } from './session.js';

type EntityClass = { name: string };

type CallInput = Partial<InvocationContext>;

/** Calls an operation server-side, in process or over the wire as the topology says. */
export async function invokeOn<T = unknown>(
  app: App,
  target: EntityClass | FrondCall,
  opOrInput?: string | CallInput,
  input?: CallInput,
  state: Record<string, unknown> = {},
): Promise<T> {
  const { call, invocation } = callValueOf(target, opOrInput, input);
  const explicit = typeof opOrInput === 'string' ? input : opOrInput;

  return (await createAppRunner(app)(call, { ...invocation, state: explicit?.state ?? state })) as T;
}

/** The session of the request a server renders, asked of the auth frond as a page would ask it. */
export async function sessionOn(app: App, state: Record<string, unknown>): Promise<SessionView> {
  try {
    return await invokeOn<SessionView>(app, SESSION_CALL, undefined, undefined, state);
  } catch (failure) {
    return nobodyWhenUnserved(failure);
  }
}
