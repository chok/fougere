import type { InvocationContext } from '@fougere/core/contract';

/** One call, unframed. */
export interface RpcCall {
  address: string;
  op: string;
  invocation: InvocationContext;
}
