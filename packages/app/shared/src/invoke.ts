import { createAppRunner, callValueOf, type App, type FrondCall, type InvocationContext } from '@fougere/core';
import { nobodyWhenUnserved, SESSION_CALL, type SessionView } from './session.js';

type EntityClass = { name: string };

type CallInput = Partial<InvocationContext>;

/**
 * Name a call server-side and let the runner place it — local façade → direct in-memory execution,
 * a frond in `remotes` → JSON-RPC on the wire.
 */
export async function invokeOn<T = unknown>(
  app: App,
  target: EntityClass | FrondCall,
  opOrInput?: string | CallInput,
  input?: CallInput,
  state: Record<string, unknown> = {},
): Promise<T> {
  const { call, invocation } = callValueOf(target, opOrInput, input);
  // An explicit `state` on the input wins over the request's — the caller who spells
  // it is answering for it, which is what makes a call outside any request possible.
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
