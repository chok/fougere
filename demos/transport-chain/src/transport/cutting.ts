import type { Transport } from '@fougere/core';

/** The world breaking, once, on one operation — so a replay has something to replay. */
export function cutting(op: string, inner: Transport): Transport {
  let cut = false;

  return async (call, invocation) => {
    if (call.op === op && !cut) {
      cut = true;
      throw new Error(`the line dropped on ${call.entity}.${call.op}`);
    }

    return inner(call, invocation);
  };
}
