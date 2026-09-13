import type { InvocationContext } from './Invocation.js';

/** Reserved namespace — calls the runner answers itself, never a façade. */
export const RPC_ENTITY = 'rpc';

/** What an `rpc` op answers — the facade for what the app says about ITSELF, never about a row. */
export type RpcAnswer = (invocation: InvocationContext, surface?: string) => unknown;
